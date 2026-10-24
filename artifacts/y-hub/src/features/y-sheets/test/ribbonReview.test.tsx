import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WorkbookProvider} from '../state/workbookContext';
import {Toolbar} from '../components/Toolbar/Toolbar';
import {YSheetsBrandMark} from '../components/YSheetsBrandMark';
afterEach(cleanup);
it('moves ribbon tab focus and activation with arrows, Home and End',()=>{
 render(<WorkbookProvider><Toolbar/></WorkbookProvider>);
 const home=screen.getByRole('tab',{name:'Home'});home.focus();
 fireEvent.keyDown(home,{key:'ArrowRight'});
 expect(screen.getByRole('tab',{name:'Insert'})).toHaveFocus();
 expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Insert');
 fireEvent.keyDown(document.activeElement!,{key:'End'});
 expect(screen.getByRole('tab',{name:'View'})).toHaveFocus();
 fireEvent.keyDown(document.activeElement!,{key:'Home'});
 expect(screen.getByRole('tab',{name:'File'})).toHaveFocus();
 expect(screen.getAllByRole('tab').filter(t=>t.tabIndex===0)).toHaveLength(1);
});
it('keeps SVG paint definitions unique when multiple brand marks are rendered',()=>{
 const {container}=render(<><YSheetsBrandMark size={16}/><YSheetsBrandMark size={24}/></>);
 const ids=[...container.querySelectorAll('[id]')].map(node=>node.id);
 expect(new Set(ids).size).toBe(ids.length);
});
it('opens the requested import/export panel each time the File commands are used',async()=>{
 render(<WorkbookProvider permissions={{canEdit:true,canExport:true}}><Toolbar/></WorkbookProvider>);
 fireEvent.click(screen.getByRole('tab',{name:'File'}));
 fireEvent.click(screen.getByRole('button',{name:'Import Excel or CSV'}));
 expect(document.querySelector('input[type="file"]')).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));
 fireEvent.click(screen.getByRole('button',{name:'Export workbook'}));
 expect(document.querySelector('input[type="file"]')).toBeNull();
 expect(screen.getByRole('button',{name:/Y-Sheets Backup/})).toBeInTheDocument();
});
