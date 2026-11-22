import { describe, expect, it } from 'vitest';
import { mergeRecovery, RecoveryMergeConflict } from '../io/mergeRecovery';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { workbookReducer } from '../state/workbookReducer';
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
    local.sheets[0].cells['0,0'] = { raw: 'same', style: { textColor: '#111111' } };
    remote.sheets[0].cells['0,0'] = { raw: 'same', style: { textColor: '#222222' } };
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
    expect(() => mergeRecovery(base, local, { ...base, version: Number.MAX_SAFE_INTEGER })).toThrow(RecoveryMergeConflict);
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
    { kind: 'structure', remote: { ...remote, sheets: remote.sheets.map((s,i) => i === 0 ? { ...s, rowCount: s.rowCount + 1 } : s) } },
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

it('combines sheet rename, different column/row sizes and independent cell changes', () => {
  const { base, local, remote } = setup();
  local.sheets[0].name = 'Local title';
  local.sheets[0].columnWidths[0] = 180;
  local.sheets[0].rowHeights[1] = 70;
  remote.sheets[0].columnWidths[1] = 240;
  remote.sheets[0].rowHeights[2] = 80;
  remote.sheets[0].cells['0,0'] = { raw: 'remote edit' };
  const before = JSON.stringify([base,local,remote]);
  const result = mergeRecovery(base,local,remote).sheets[0];
  expect(result.name).toBe('Local title');
  expect(result.columnWidths).toMatchObject({ 0:180,1:240 });
  expect(result.rowHeights).toMatchObject({ 1:70,2:80 });
  expect(result.cells['0,0'].raw).toBe('remote edit');
  expect(JSON.stringify([base,local,remote])).toBe(before);
});
it.each(['columnWidths','rowHeights'] as const)('rejects competing %s changes and accepts identical ones', field => {
  const { base,local,remote } = setup();
  local.sheets[0][field][0] = 123; remote.sheets[0][field][0] = 456;
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
  try { mergeRecovery(base,local,remote); } catch(error) { expect(error).toMatchObject({ kind:'layout',cells:[] }); }
  remote.sheets[0][field][0] = 123;
  expect(mergeRecovery(base,local,remote).sheets[0][field][0]).toBe(123);
});
it('supports resetting a size to default but rejects reset against a competing size', () => {
  const {base,local,remote} = setup();
  base.sheets[0].columnWidths[0] = 100;
  remote.sheets[0].columnWidths[0] = 100;
  delete local.sheets[0].columnWidths[0];
  expect(mergeRecovery(base,local,remote).sheets[0].columnWidths[0]).toBeUndefined();
  remote.sheets[0].columnWidths[0] = 150;
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
});
it('distinguishes competing sheet names from workbook renames', () => {
  const {base,local,remote} = setup();
  local.sheets[0].name = 'Local'; remote.sheets[0].name = 'Remote';
  try { mergeRecovery(base,local,remote); throw Error('Expected conflict'); }
  catch(error) { expect(error).toMatchObject({ kind:'layout' }); }
  remote.sheets[0].name = 'Local';
  expect(mergeRecovery(base,local,remote).sheets[0].name).toBe('Local');
});
it('still rejects coordinate and semantic changes alongside presentation edits', () => {
  const {base,local,remote} = setup();
  local.sheets[0].name = 'Local';
  remote.sheets[0].mergedCells.push({id:'merge',startRow:0,endRow:1,startCol:0,endCol:1});
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
  remote.sheets[0].mergedCells = [];
  remote.sheets[0].validations['0,0'] = {type:'wholeNumber',value1:1};
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
  remote.sheets[0].validations = {};
  remote.sheets.reverse();
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
});
it('merges real reducer mutations despite unequal editor counters and recalculates merged formulas', () => {
  const {base} = setup(), sheetId = base.sheets[0].id;
  let local = workbookReducer(base,{type:'SET_CELL_RAW',payload:{sheetId,row:0,col:0,raw:'=2+3'}});
  local = workbookReducer(local,{type:'RENAME_SHEET',payload:{sheetId,newName:'Local title'}});
  local = workbookReducer(local,{type:'SET_ROW_HEIGHT',payload:{sheetId,row:0,height:70}});
  let remote = workbookReducer(base,{type:'SET_CELL_RAW',payload:{sheetId,row:0,col:1,raw:'=A1*2'}});
  remote = workbookReducer(remote,{type:'SET_COL_WIDTH',payload:{sheetId,col:1,width:180}});
  expect(local.version).not.toBe(remote.version);
  const merged = mergeRecovery(base,local,remote);
  expect(merged.version).toBe(Math.max(local.version,remote.version)+1);
  const result = workbookReducer(merged,{type:'SET_WORKBOOK',payload:merged});
  expect(result.sheets[0].cells['0,0'].computed).toBe(5);
  expect(result.sheets[0].cells['0,1'].computed).toBe(10);
  expect(result.sheets[0].name).toBe('Local title');
  expect(result.sheets[0].rowHeights[0]).toBe(70);
  expect(result.sheets[0].columnWidths[1]).toBe(180);
});
it('rejects independent renames that create duplicate sheet names after merging', () => {
  const {base,local,remote} = setup();
  local.sheets[0].name = 'Combined'; remote.sheets[1].name = 'combined';
  try { mergeRecovery(base,local,remote); throw Error('Expected conflict'); }
  catch(error) { expect(error).toMatchObject({kind:'layout'}); }
});
it('combines actual raw editing with formatting of the same cell and recalculates formulas', () => {
  const {base} = setup(), sheetId = base.sheets[0].id;
  const local = workbookReducer(base,{type:'SET_CELL_RAW',payload:{sheetId,row:0,col:0,raw:'=3*7'}});
  const remote = workbookReducer(base,{type:'FORMAT_CELLS',payload:{sheetId,range:{startRow:0,endRow:0,startCol:0,endCol:0},style:{bold:true,textColor:'#123456'}}});
  const merged = mergeRecovery(base,local,remote);
  const result = workbookReducer(merged,{type:'SET_WORKBOOK',payload:merged});
  expect(result.sheets[0].cells['0,0']).toMatchObject({raw:'=3*7',computed:21,style:{bold:true,textColor:'#123456'}});
});
it('combines independent formatting fields without changing either input', () => {
  const {base,local,remote} = setup();
  base.sheets[0].cells['0,0'] = {raw:'same'};
  local.sheets[0].cells['0,0'] = {raw:'same',style:{bold:true}};
  remote.sheets[0].cells['0,0'] = {raw:'same',style:{italic:true}};
  const before = JSON.stringify([base,local,remote]);
  expect(mergeRecovery(base,local,remote).sheets[0].cells['0,0']).toEqual({raw:'same',style:{bold:true,italic:true}});
  expect(JSON.stringify([base,local,remote])).toBe(before);
});
it('merges reset of one style field with a different field edit, including explicit false', () => {
  const {base,local,remote} = setup();
  base.sheets[0].cells['0,0'] = {raw:'same',style:{bold:true,italic:true}};
  local.sheets[0].cells['0,0'] = {raw:'same',style:{italic:true}};
  remote.sheets[0].cells['0,0'] = {raw:'same',style:{bold:true,italic:false}};
  expect(mergeRecovery(base,local,remote).sheets[0].cells['0,0']).toEqual({raw:'same',style:{italic:false}});
});
it('rejects reset and change of the same field without losing the original', () => {
  const {base,local,remote} = setup();
  base.sheets[0].cells['0,0'] = {raw:'same',style:{bold:true}};
  local.sheets[0].cells['0,0'] = {raw:'same'};
  remote.sheets[0].cells['0,0'] = {raw:'same',style:{bold:false}};
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
});
it('keeps each border atomic and rejects conflicting border color versus line changes', () => {
  const {base,local,remote} = setup();
  base.sheets[0].cells['0,0'] = {raw:'same',style:{borderTop:{style:'thin',color:'#000000'}}};
  local.sheets[0].cells['0,0'] = {raw:'same',style:{borderTop:{style:'thin',color:'#ffffff'}}};
  remote.sheets[0].cells['0,0'] = {raw:'same',style:{borderTop:{style:'double',color:'#000000'}}};
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
});
it('rejects whole-cell deletion against formatting and reports one location for multiple conflicts', () => {
  const {base,local,remote} = setup();
  base.sheets[0].cells['0,0'] = {raw:'old'};
  delete local.sheets[0].cells['0,0'];
  remote.sheets[0].cells['0,0'] = {raw:'old',style:{bold:true}};
  expect(() => mergeRecovery(base,local,remote)).toThrow(RecoveryMergeConflict);
  local.sheets[0].cells['0,0'] = {raw:'left',style:{textColor:'#111111'}};
  remote.sheets[0].cells['0,0'] = {raw:'right',style:{textColor:'#222222'}};
  try { mergeRecovery(base,local,remote); throw Error('Expected conflict'); }
  catch(error) { expect(error).toMatchObject({kind:'cells',totalCells:1}); }
});
it('merges formatting of a previously absent cell with a real typed value', () => {
  const {base} = setup(), sheetId = base.sheets[0].id;
  delete base.sheets[0].cells['7,7'];
  const local = workbookReducer(base,{type:'SET_CELL_RAW',payload:{sheetId,row:7,col:7,raw:'typed'}});
  const remote = workbookReducer(base,{type:'FORMAT_CELLS',payload:{sheetId,range:{startRow:7,endRow:7,startCol:7,endCol:7},style:{italic:true}}});
  expect(remote.sheets[0].cells['7,7'].raw).toBe('');
  expect(mergeRecovery(base,local,remote).sheets[0].cells['7,7']).toEqual({raw:'typed',style:{italic:true}});
});
