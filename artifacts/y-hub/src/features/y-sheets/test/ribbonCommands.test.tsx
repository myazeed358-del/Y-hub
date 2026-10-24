import '@testing-library/jest-dom/vitest';
import {act,cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WorkbookProvider,useWorkbook,type WorkbookContextType} from '../state/workbookContext';
import {Toolbar} from '../components/Toolbar/Toolbar';
import {SheetTabs} from '../components/SheetTabs/SheetTabs';
import {createDefaultWorkbook} from '../state/defaultWorkbook';
afterEach(cleanup);
function setup(){
 let current!:WorkbookContextType;const Probe=()=>{current=useWorkbook();return null;};
 const wb=createDefaultWorkbook();wb.sheets=[{...wb.sheets[0],name:'Sheet 1',cells:{'0,0':{raw:'3'},'1,0':{raw:'1'},'2,0':{raw:'2'}},mergedCells:[]}];wb.activeSheetId=wb.sheets[0].id;
 render(<WorkbookProvider initialWorkbook={wb}><Toolbar/><SheetTabs/><Probe/></WorkbookProvider>);return ()=>current;
}
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));
it('keeps font, color, alignment, borders, number formatting and undo/redo wired',()=>{
 const current=setup();click('Bold (Ctrl+B)');click('Italic (Ctrl+I)');click('Underline (Ctrl+U)');
 fireEvent.change(screen.getByLabelText('Font size'),{target:{value:'16'}});
 fireEvent.change(screen.getByLabelText('Text color'),{target:{value:'#112233'}});fireEvent.change(screen.getByLabelText('Fill color'),{target:{value:'#22d3ee'}});click('Align center');click('Percentage');
 fireEvent.change(screen.getByLabelText('Cell borders'),{target:{value:'all'}});
 expect(current().activeSheet.cells['0,0'].style).toMatchObject({bold:true,italic:true,underline:true,fontSize:16,textColor:'#112233',backgroundColor:'#22d3ee',horizontalAlign:'center',numberFormat:'percentage'});
 expect(current().activeSheet.cells['0,0'].style?.borderTop).toBeTruthy();
 click('Undo (Ctrl+Z)');expect(current().activeSheet.cells['0,0'].style?.borderTop).toBeFalsy();click('Redo (Ctrl+Y)');expect(current().activeSheet.cells['0,0'].style?.borderTop).toBeTruthy();
});
it('keeps clipboard and merge commands connected to the active selection',async()=>{
 const current=setup();click('Copy (Ctrl+C)');act(()=>current().setActiveCell({row:3,col:0}));await act(async()=>click('Paste (Ctrl+V)'));expect(current().activeSheet.cells['3,0'].raw).toBe('3');
 act(()=>current().setSelection({startRow:0,startCol:1,endRow:0,endCol:2}));click('Merge or unmerge cells');expect(current().activeSheet.mergedCells).toHaveLength(1);click('Merge or unmerge cells');expect(current().activeSheet.mergedCells).toHaveLength(0);
});
it('sorts and filters the selected range from the Data tab',()=>{
 const current=setup();act(()=>current().setSelection({startRow:0,startCol:0,endRow:2,endCol:0}));fireEvent.click(screen.getByRole('tab',{name:'Data'}));click('Sort ascending');expect([0,1,2].map(r=>current().activeSheet.cells[`${r},0`].raw)).toEqual(['1','2','3']);click('Sort descending');expect(current().activeSheet.cells['0,0'].raw).toBe('3');click('Toggle filter');expect(current().activeSheet.filter).toBeTruthy();click('Toggle filter');expect(current().activeSheet.filter).toBeUndefined();click('Find and replace');expect(screen.getByPlaceholderText(/Text or number to find/)).toBeInTheDocument();
});
it('creates and renames a worksheet through the existing controls',()=>{
 const current=setup();fireEvent.click(screen.getByRole('tab',{name:'Insert'}));click('Add worksheet');expect(current().workbook.sheets).toHaveLength(2);click('Options for worksheet Sheet2');click('Rename');fireEvent.change(screen.getByLabelText('Worksheet name'),{target:{value:'Renamed'}});fireEvent.keyDown(screen.getByLabelText('Worksheet name'),{key:'Enter'});expect(current().activeSheet.name).toBe('Renamed');
});
