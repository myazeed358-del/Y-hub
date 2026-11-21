import { describe, expect, it } from 'vitest';
import { mergeRecovery, RecoveryMergeConflict } from '../io/mergeRecovery';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { validateWorkbook } from '../io/workbookValidation';
const setup = () => { const base = validateWorkbook(createDefaultWorkbook()); return { base, local: structuredClone(base), remote: structuredClone(base) }; };
describe('conservative recovery merge', () => {
  it('combines different cells without mutating inputs or trusting computed caches', () => {
    const { base, local, remote } = setup();
    local.sheets[0].cells['0,0'] = { raw: '=1+2', computed: 999, error: 'stale' };
    remote.sheets[0].cells['0,1'] = { raw: 'remote', style: { bold: true } };
    const before = JSON.stringify([base, local, remote]);
    const result = mergeRecovery(base, local, remote);
    expect(result.sheets[0].cells['0,0']).toEqual({ raw: '=1+2' });
    expect(result.sheets[0].cells['0,1']).toEqual(remote.sheets[0].cells['0,1']);
    expect(JSON.stringify([base, local, remote])).toBe(before);
  });
  it('accepts identical concurrent edits and ignores derived cache differences', () => {
    const { base, local, remote } = setup();
    local.sheets[0].cells['0,0'] = { raw: 'same', computed: 1 };
    remote.sheets[0].cells['0,0'] = { raw: 'same', computed: 2 };
    expect(mergeRecovery(base, local, remote).sheets[0].cells['0,0']).toEqual({ raw: 'same' });
  });
  it('rejects overlapping raw or formatting edits atomically', () => {
    const { base, local, remote } = setup();
    local.sheets[0].cells['0,0'] = { raw: 'local' };
    remote.sheets[0].cells['0,0'] = { raw: 'remote' };
    expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
    remote.sheets[0].cells['0,0'] = { raw: 'local', style: { bold: true } };
    expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
  });
  it('merges deletion versus unchanged but rejects deletion versus edit', () => {
    const { base, local, remote } = setup();
    base.sheets[0].cells['0,0'] = { raw: 'old' };
    delete local.sheets[0].cells['0,0'];
    remote.sheets[0].cells['0,0'] = { raw: 'old' };
    expect(mergeRecovery(base, local, remote).sheets[0].cells['0,0']).toBeUndefined();
    remote.sheets[0].cells['0,0'].raw = 'new';
    expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
  });
  it('rejects structural edits, sheet deletion/reordering and foreign identities', () => {
    const { base, local, remote } = setup();
    remote.sheets[0].rowCount++;
    expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
    expect(() => mergeRecovery(base, local, { ...base, id: 'other' })).toThrow(RecoveryMergeConflict);
    expect(() => mergeRecovery(base, local, { ...base, version: 2 })).toThrow(RecoveryMergeConflict);
  });
  it('merges a one-sided name change but rejects competing renames', () => {
    const { base, local, remote } = setup();
    remote.name = 'Remote name';
    expect(mergeRecovery(base, local, remote).name).toBe('Remote name');
    local.name = 'Local name';
    expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
  });
});

it('reports bounded, stable cell locations and total count without cell contents', () => {
  const { base, local, remote } = setup();
  for (let row = 12; row >= 0; row--) {
    local.sheets[0].cells[`${row},0`] = { raw: 'secret local' };
    remote.sheets[0].cells[`${row},0`] = { raw: 'secret remote' };
  }
  try { mergeRecovery(base, local, remote); throw Error('Expected conflict'); }
  catch (error) {
    expect(error).toBeInstanceOf(RecoveryMergeConflict);
    const conflict = error as RecoveryMergeConflict;
    expect(conflict.kind).toBe('cells'); expect(conflict.totalCells).toBe(13);
    expect(conflict.cells.map(c => c.address)).toEqual(['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10']);
    expect(JSON.stringify(conflict)).not.toContain('secret');
  }
});
it('distinguishes identity, structure and rename conflicts without inventing cell locations', () => {
  const { base, local, remote } = setup();
  const scenarios = [
    { kind: 'identity', remote: { ...remote, id: 'other' } },
    { kind: 'structure', remote: { ...remote, version: remote.version + 1 } },
    { kind: 'name', remote: { ...remote, name: 'Remote rename' } },
  ];
  local.name = 'Local rename';
  for (const scenario of scenarios) {
    try { mergeRecovery(base, local, scenario.remote); throw Error('Expected conflict'); }
    catch (error) { expect(error).toMatchObject({ kind: scenario.kind, cells: [], totalCells: 0 }); }
  }
});
it('reports columns beyond Z and keeps sheet identity in the display location', () => {
  const { base, local, remote } = setup();
  for (const wb of [base, local, remote]) wb.sheets[0].colCount = 30;
  local.sheets[0].cells['1,26'] = { raw: 'left' };
  remote.sheets[0].cells['1,26'] = { raw: 'right' };
  expect(() => mergeRecovery(base, local, remote)).toThrow(RecoveryMergeConflict);
  try { mergeRecovery(base, local, remote); }
  catch (error) { expect((error as RecoveryMergeConflict).cells).toEqual([{ sheetName: base.sheets[0].name, address: 'AA2' }]); }
});
