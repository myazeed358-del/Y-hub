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
