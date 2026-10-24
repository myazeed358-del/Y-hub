import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WorkbookProvider,useWorkbook} from '../state/workbookContext';
import {createDefaultWorkbook} from '../state/defaultWorkbook';
afterEach(cleanup);
function setup(){
 const wb=createDefaultWorkbook();const blank={...wb.sheets[0],rowCount:4,colCount:4,mergedCells:[],conditionalFormats:[],validations:{}};
 wb.sheets=[{...blank,id:'a',name:'A',cells:{'0,0':{raw:'1'},'1,0':{raw:'2'}}},{...blank,id:'b',name:'B',cells:{'0,0':{raw:'9'}}}];wb.activeSheetId='a';
 return renderHook(()=>useWorkbook(),{wrapper:({children})=><WorkbookProvider initialWorkbook={wb}>{children}</WorkbookProvider>});
}
it('cut and paste into the same cell never clears its value',async()=>{
 const {result}=setup();act(()=>result.current.cutSelection());await act(()=>result.current.pasteSelection());expect(result.current.activeSheet.cells['0,0']?.raw).toBe('1');
});
it('overlapping cut preserves destination values and undoes in one step',async()=>{
 const {result}=setup();act(()=>result.current.setSelection({startRow:0,startCol:0,endRow:1,endCol:0}));act(()=>result.current.cutSelection());act(()=>result.current.setActiveCell({row:1,col:0}));await act(()=>result.current.pasteSelection());
 expect(result.current.activeSheet.cells['0,0']).toBeUndefined();expect(result.current.activeSheet.cells['1,0']?.raw).toBe('1');expect(result.current.activeSheet.cells['2,0']?.raw).toBe('2');
 act(()=>result.current.undo());expect(result.current.activeSheet.cells['0,0']?.raw).toBe('1');expect(result.current.activeSheet.cells['1,0']?.raw).toBe('2');
});
it('cross-sheet cut clears only the source sheet and remains atomic for undo',async()=>{
 const {result}=setup();act(()=>result.current.cutSelection());act(()=>result.current.dispatch({type:'SET_ACTIVE_SHEET',payload:'b'}));await act(()=>result.current.pasteSelection());
 expect(result.current.workbook.sheets[0].cells['0,0']).toBeUndefined();expect(result.current.workbook.sheets[1].cells['0,0']?.raw).toBe('1');
 act(()=>result.current.undo());expect(result.current.workbook.sheets[0].cells['0,0']?.raw).toBe('1');expect(result.current.workbook.sheets[1].cells['0,0']?.raw).toBe('9');
});
it('refuses a clipped cut rather than erasing values that cannot fit',async()=>{
 const {result}=setup();act(()=>result.current.setSelection({startRow:0,startCol:0,endRow:1,endCol:0}));act(()=>result.current.cutSelection());act(()=>result.current.setActiveCell({row:3,col:0}));await act(()=>result.current.pasteSelection());
 expect(result.current.activeSheet.cells['0,0']?.raw).toBe('1');expect(result.current.activeSheet.cells['1,0']?.raw).toBe('2');expect(result.current.clipboard?.isCut).toBe(true);
});
it('copying a blank cell clears an existing destination value',async()=>{
 const {result}=setup();act(()=>result.current.setActiveCell({row:2,col:0}));act(()=>result.current.copySelection());act(()=>result.current.setActiveCell({row:0,col:0}));await act(()=>result.current.pasteSelection());expect(result.current.activeSheet.cells['0,0']).toBeUndefined();
});
