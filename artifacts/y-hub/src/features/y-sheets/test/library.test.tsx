import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {WorkbookDirectory} from '../workspace/WorkbookDirectory';
import {WorkbookPreview} from '../workspace/WorkbookPreview';
import {DirectoryError} from '../workspace/directoryRepository';
const mocks=vi.hoisted(()=>({browse:vi.fn(),save:vi.fn(),preview:vi.fn(),classify:vi.fn()}));
vi.mock('../workspace/directoryRepository',async original=>({...await original<typeof import('../workspace/directoryRepository')>(),directoryRepository:mocks}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
const item={kind:'workbook' as const,id:'file',name:'Saved file',parent_id:null,favorite:false,pinned:false,revision:4,organization_revision:0,category:'Course',category_revision:7,updated_at:'2026-11-18T00:00:00Z'};
const data={revision:4,sheetName:'Stored sheet',sheetCount:2,cells:Array.from({length:24},(_,i)=>({row:Math.floor(i/4),col:i%4,text:i===0?'=2+3':i===1?'<img src=x onerror=alert(1)>':'',truncated:false}))};
beforeEach(()=>{vi.resetAllMocks();mocks.browse.mockResolvedValue({items:[item],trail:[],more:false});mocks.preview.mockResolvedValue(data);mocks.classify.mockResolvedValue(8);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function directory(){render(<WorkbookDirectory owner="owner" busy={false} open={vi.fn()} rename={vi.fn()} remove={vi.fn()}/>);await screen.findByRole('article',{name:'Saved file'});}
it('loads real saved inputs only after requesting preview and renders markup as text',async()=>{
 const storage=vi.spyOn(Storage.prototype,'setItem');await directory();expect(mocks.preview).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Preview'}));await screen.findByText('=2+3');expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();expect(document.querySelector('.ys-cell-preview img')).toBeNull();expect(mocks.preview).toHaveBeenCalledWith('owner','file',4);expect(storage).not.toHaveBeenCalled();
});
it('clears preview content on offline and ignores a late response',async()=>{
 let finish!:(x:typeof data)=>void;mocks.preview.mockImplementationOnce(()=>new Promise(r=>finish=r));render(<WorkbookPreview owner="owner" id="file" revision={4} onClose={vi.fn()}/>);fireEvent.offline(window);await act(async()=>finish(data));expect(screen.queryByText('=2+3')).toBeNull();expect(screen.getByRole('alert')).toBeTruthy();
});
it('shows revision/access failure without using stale cell content',async()=>{
 mocks.preview.mockRejectedValue(new DirectoryError('conflict'));render(<WorkbookPreview owner="owner" id="file" revision={4} onClose={vi.fn()}/>);await screen.findByRole('alert');expect(screen.queryByRole('table')).toBeNull();expect(mocks.preview).toHaveBeenCalledTimes(1);
});
it('does not let an old owner response overwrite the new preview',async()=>{
 let finish!:(x:typeof data)=>void;mocks.preview.mockImplementationOnce(()=>new Promise(r=>finish=r)).mockResolvedValueOnce({...data,sheetName:'New owner sheet'});const view=render(<WorkbookPreview owner="old" id="file" revision={4} onClose={vi.fn()}/>);view.rerender(<WorkbookPreview owner="new" id="other" revision={4} onClose={vi.fn()}/>);await screen.findByText(/New owner sheet/);await act(async()=>finish({...data,sheetName:'Old owner sheet'}));expect(screen.queryByText(/Old owner sheet/)).toBeNull();
});
it('submits category with its own loaded revision without changing file content',async()=>{
 await directory();fireEvent.click(screen.getByRole('button',{name:'Classify'}));const form=screen.getByRole('form',{name:'Classify item'});expect((within(form).getByLabelText('Item category') as HTMLInputElement).value).toBe('Course');fireEvent.change(within(form).getByLabelText('Item category'),{target:{value:'Research'}});fireEvent.submit(form);await waitFor(()=>expect(mocks.classify).toHaveBeenCalledWith('owner',item,'Research'));expect(mocks.save).not.toHaveBeenCalled();
});
it('filters categories globally and distinguishes uncategorized from all categories',async()=>{
 await directory();fireEvent.change(screen.getByLabelText('Category filter'),{target:{value:'Course'}});fireEvent.click(screen.getByRole('button',{name:'Filter category'}));await waitFor(()=>expect(mocks.browse).toHaveBeenLastCalledWith('owner',expect.objectContaining({category:'Course',view:'all'}),0));
 fireEvent.click(screen.getByRole('button',{name:'Unclassified'}));await waitFor(()=>expect(mocks.browse).toHaveBeenLastCalledWith('owner',expect.objectContaining({category:''}),0));fireEvent.click(screen.getByRole('button',{name:'All categories'}));await waitFor(()=>expect(mocks.browse).toHaveBeenLastCalledWith('owner',expect.objectContaining({category:null}),0));
});
it('reports stale category changes without silent retries',async()=>{
 mocks.classify.mockRejectedValue(new DirectoryError('conflict'));await directory();fireEvent.click(screen.getByRole('button',{name:'Classify'}));fireEvent.click(screen.getByRole('button',{name:'Save category'}));await screen.findByRole('alert');expect(mocks.classify).toHaveBeenCalledTimes(1);
});
it('clears an opened preview when the directory refreshes after access denial',async()=>{
 await directory();fireEvent.click(screen.getByRole('button',{name:'Preview'}));await screen.findByText('=2+3');mocks.browse.mockRejectedValue(new DirectoryError('denied'));fireEvent.focus(window);await screen.findByRole('alert');expect(screen.queryByText('=2+3')).toBeNull();expect(screen.queryByRole('article')).toBeNull();
});
it('explains an empty bounded area instead of showing a fabricated thumbnail',async()=>{
 mocks.preview.mockResolvedValue({...data,cells:data.cells.map(c=>({...c,text:''}))});render(<WorkbookPreview owner="owner" id="file" revision={4} onClose={vi.fn()}/>);await screen.findByText('No saved inputs in this area.');expect(screen.getAllByRole('cell')).toHaveLength(24);
});
