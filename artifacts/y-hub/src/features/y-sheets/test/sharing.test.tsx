import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { SharedWorkbookView } from '../sharing/SharedWorkbookView';
import { SharePanel } from '../sharing/SharePanel';
import { WorkbookStorageError } from '../integration/storageErrors';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
const mocks=vi.hoisted(()=>({inherited:vi.fn(),read:vi.fn(),save:vi.fn(),shares:vi.fn(),set:vi.fn(),preview:vi.fn(),props:null as any,guard:null as any}));
vi.mock('../sharing/repository',()=>({sharingRepository:mocks}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
vi.mock('next-themes',()=>({useTheme:()=>({resolvedTheme:'dark'})}));
vi.mock('@/shared/navigation/guardedLocation',()=>({useNavigationGuard:(fn:()=>boolean)=>{mocks.guard=fn;}}));
vi.mock('../integration/YSheetsHostAdapter',()=>({YSheetsHostAdapter:(props:any)=>{mocks.props=props;return <div data-testid="shared-editor"><button onClick={()=>props.onSave({...props.initialWorkbook,sheets:[{...props.initialWorkbook.sheets[0],cells:{'0,0':{raw:'Changed'}}}]})}>Edit cell</button></div>;}}));
const wb=createDefaultWorkbook(),loaded={workbook:wb,permission:'edit' as const,grantRevision:7,revision:3};
beforeEach(()=>{vi.clearAllMocks();mocks.inherited.mockResolvedValue([]);mocks.read.mockResolvedValue(loaded);mocks.save.mockResolvedValue(4);mocks.shares.mockResolvedValue([]);mocks.set.mockResolvedValue(1);localStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function open(){render(<SharedWorkbookView actor="recipient" id={wb.id} onClose={vi.fn()}/>);await screen.findByTestId('shared-editor');}
it('passes view-only permissions and blocks export, rename and new-workbook replacement',async()=>{
 mocks.read.mockResolvedValue({...loaded,permission:'view'});await open();expect(mocks.props.permissions).toMatchObject({canEdit:false,canExport:false,canCreateSheet:false});expect(mocks.props.allowNewWorkbook).toBe(false);expect(mocks.props.allowRenameWorkbook).toBe(false);
 fireEvent.click(screen.getByText('Edit cell'));expect(mocks.save).not.toHaveBeenCalled();
});
it('saves editor changes with the loaded grant epoch and content revision without local storage',async()=>{
 const store=vi.spyOn(Storage.prototype,'setItem');await open();fireEvent.click(screen.getByText('Edit cell'));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));expect(mocks.save).toHaveBeenCalledWith('recipient',wb.id,7,expect.any(String),3,expect.objectContaining({id:wb.id}));expect(store).not.toHaveBeenCalled();
});
it('closes and cancels queued edits immediately on offline without retaining recovery',async()=>{
 await open();fireEvent.click(screen.getByText('Edit cell'));fireEvent.offline(window);await screen.findByRole('alert');expect(screen.queryByTestId('shared-editor')).toBeNull();expect(mocks.save).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);
});
it('revalidates the loaded epoch on focus and removes content on revoked access',async()=>{
 await open();mocks.read.mockRejectedValueOnce(new WorkbookStorageError('session','Revoked'));fireEvent.focus(window);await screen.findByRole('alert');expect(mocks.read).toHaveBeenLastCalledWith('recipient',wb.id,7,false);expect(screen.queryByTestId('shared-editor')).toBeNull();
});
it('does not restore a late initial response after offline invalidation',async()=>{
 let finish!:(data:typeof loaded)=>void;mocks.read.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));render(<SharedWorkbookView actor="recipient" id={wb.id} onClose={vi.fn()}/>);
 fireEvent.offline(window);await act(async()=>finish(loaded));expect(screen.queryByTestId('shared-editor')).toBeNull();
});
it('does not restore the editor after a late save acknowledgment',async()=>{
 let finish!:(revision:number)=>void;mocks.save.mockImplementation(()=>new Promise(r=>{finish=r;}));await open();fireEvent.click(screen.getByText('Edit cell'));await waitFor(()=>expect(mocks.save).toHaveBeenCalled());fireEvent.offline(window);await act(async()=>finish(4));expect(screen.queryByTestId('shared-editor')).toBeNull();
});
it('shows a conflict without rebasing or retrying and keeps changes only in memory',async()=>{
 mocks.save.mockRejectedValue(new WorkbookStorageError('conflict','Conflict'));await open();fireEvent.click(screen.getByText('Edit cell'));await screen.findByText(/Save conflict/);expect(mocks.save).toHaveBeenCalledTimes(1);expect(screen.getByTestId('shared-editor')).toBeTruthy();expect(localStorage.length).toBe(0);
});
it('network save failure closes access instead of queuing an offline replay',async()=>{
 mocks.save.mockRejectedValue(new WorkbookStorageError('network','Offline'));await open();fireEvent.click(screen.getByText('Edit cell'));await screen.findByRole('alert');expect(mocks.save).toHaveBeenCalledTimes(1);expect(screen.queryByTestId('shared-editor')).toBeNull();
});
it('requires explicit discard on navigation when shared edits are unsaved',async()=>{
 await open();fireEvent.click(screen.getByText('Edit cell'));const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);expect(mocks.guard()).toBe(false);confirm.mockReturnValue(true);expect(mocks.guard()).toBe(true);expect(localStorage.length).toBe(0);
});
it('previews an exact number and confirms the displayed recipient with its current share revision',async()=>{
 mocks.preview.mockResolvedValue({id:'target',number:'123456789',name:'Recipient',revision:9});render(<SharePanel actor="owner" id="file" name="Budget" onClose={vi.fn()}/>);
 await waitFor(()=>expect((screen.getByRole('button',{name:'Refresh sharing'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.change(screen.getByLabelText('Y-Hub number'),{target:{value:'123456789'}});fireEvent.click(screen.getByText('Find account'));await screen.findByText('Recipient');expect(mocks.set).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Permission'),{target:{value:'edit'}});fireEvent.click(screen.getByText('Confirm sharing with this account'));await waitFor(()=>expect(mocks.set).toHaveBeenCalledWith('owner','file','target','edit',9,'workbook'));
});
it('revokes with the displayed revision and reports a stale sharing conflict',async()=>{
 mocks.shares.mockResolvedValue([{id:'target',number:'123456789',name:'Recipient',permission:'edit',revision:4}]);mocks.set.mockRejectedValue(new WorkbookStorageError('conflict','Stale'));
 render(<SharePanel actor="owner" id="file" name="Budget" onClose={vi.fn()}/>);await screen.findByText('Recipient');fireEvent.change(screen.getByLabelText('Permission for 123456789'),{target:{value:'none'}});await screen.findByRole('alert');expect(mocks.set).toHaveBeenCalledWith('owner','file','target','none',4,'workbook');expect(mocks.set).toHaveBeenCalledTimes(1);
});

it('acknowledges a committed cell draft without treating it as permanently unsaved',async()=>{
 await open();act(()=>mocks.props.onDraftChange({sheetId:wb.activeSheetId,row:0,col:0,raw:'Changed'}));
 fireEvent.click(screen.getByText('Edit cell'));await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));await screen.findByText('Saved');
 expect(mocks.guard()).toBe(true);
});

it('requires confirmation of current and future inheritance before granting a folder',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 mocks.preview.mockResolvedValue({id:'target',number:'123456789',name:'Recipient',revision:0});
 render(<SharePanel actor="owner" id="folder" name="Course" kind="folder" onClose={vi.fn()}/>);
 await waitFor(()=>expect((screen.getByLabelText('Y-Hub number') as HTMLInputElement).disabled).toBe(false));
 fireEvent.change(screen.getByLabelText('Y-Hub number'),{target:{value:'123456789'}});fireEvent.click(screen.getByText('Find account'));await screen.findByText('Recipient');
 fireEvent.click(screen.getByText('Confirm sharing with this account'));expect(mocks.set).not.toHaveBeenCalled();expect(confirm).toHaveBeenCalledWith(expect.stringContaining('current and future'));
 confirm.mockReturnValue(true);fireEvent.click(screen.getByText('Confirm sharing with this account'));await waitFor(()=>expect(mocks.set).toHaveBeenCalledWith('owner','folder','target','view',0,'folder'));
 expect(mocks.inherited).not.toHaveBeenCalled();
});
it('shows inherited sources separately without editable permission controls',async()=>{
 mocks.inherited.mockResolvedValue([{id:'target',number:'123456789',name:'Inherited recipient',permission:'view',folderId:'source',folderName:'Parent course'}]);
 render(<SharePanel actor="owner" id="file" name="Budget" onClose={vi.fn()}/>);
 await screen.findByText('Parent course');expect(screen.queryByLabelText('Permission for 123456789')).toBeNull();expect(mocks.set).not.toHaveBeenCalled();
 mocks.inherited.mockRejectedValue(new WorkbookStorageError('session','Denied'));fireEvent.focus(window);await screen.findByText('Unable to refresh inherited access.');expect(screen.queryByText('Parent course')).toBeNull();
});
it('does not display inherited metadata from a late response after unmount',async()=>{
 let finish!:(rows:any[])=>void;mocks.inherited.mockImplementationOnce(()=>new Promise(r=>finish=r));
 const view=render(<SharePanel actor="owner" id="file" name="Budget" onClose={vi.fn()}/>);view.unmount();
 await act(async()=>finish([{id:'target',number:'123456789',name:'Recipient',permission:'view',folderId:'source',folderName:'Private source'}]));expect(screen.queryByText('Private source')).toBeNull();
});
