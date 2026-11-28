import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {TrashPanel} from '../trash/TrashPanel';
const mocks=vi.hoisted(()=>({list:vi.fn(),restore:vi.fn(),purge:vi.fn()}));
vi.mock('../trash/repository',()=>({trashRepository:mocks}));
vi.mock('@/i18n/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
const row={id:'entry',rootId:'root',kind:'folder',name:'Deleted course',deletedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),fileCount:2,folderCount:3};
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue([row]);mocks.restore.mockResolvedValue('root');mocks.purge.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
async function open(onRestored=vi.fn()){render(<TrashPanel actor="owner" onRestored={onRestored} onClose={vi.fn()}/>);await screen.findByText('Deleted course');return onRestored;}
it('shows metadata and deadline without opening archived content',async()=>{await open();expect(screen.getByText('Deleted course')).toBeTruthy();expect(document.querySelector('time')?.dateTime).toBe(row.expiresAt);expect(screen.queryByRole('button',{name:'Open'})).toBeNull();});
it('requires explicit private restore confirmation and supports cancellation',async()=>{
 const changed=await open(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByText('Restore privately'));expect(mocks.restore).not.toHaveBeenCalled();expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Previous shares remain revoked'));
 confirm.mockReturnValue(true);mocks.list.mockResolvedValue([]);fireEvent.click(screen.getByText('Restore privately'));await screen.findByText('Trash is empty.');expect(mocks.restore).toHaveBeenCalledWith('owner','entry');expect(changed).toHaveBeenCalledTimes(1);
});
it('requires irreversible purge confirmation and never treats it as restore',async()=>{
 const changed=await open(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByText('Delete permanently'));expect(mocks.purge).not.toHaveBeenCalled();confirm.mockReturnValue(true);mocks.list.mockResolvedValue([]);fireEvent.click(screen.getByText('Delete permanently'));await screen.findByText('Trash is empty.');expect(mocks.purge).toHaveBeenCalledWith('owner','entry');expect(changed).not.toHaveBeenCalled();
});
it('does not report a failed restore as success or retain stale metadata',async()=>{const changed=await open();vi.spyOn(window,'confirm').mockReturnValue(true);mocks.restore.mockRejectedValue(new Error('Expired'));fireEvent.click(screen.getByText('Restore privately'));await screen.findByRole('alert');expect(screen.queryByText('Deleted course')).toBeNull();expect(changed).not.toHaveBeenCalled();});
it('refreshes on focus and clears metadata when access is denied',async()=>{await open();mocks.list.mockRejectedValue(new Error('Denied'));fireEvent.focus(window);await screen.findByRole('alert');expect(screen.queryByText('Deleted course')).toBeNull();});
it('disables already expired restoration but permits explicit purge',async()=>{mocks.list.mockResolvedValue([{...row,expiresAt:'2020-01-01T00:00:00Z'}]);await open();expect((screen.getByText('Restore privately') as HTMLButtonElement).disabled).toBe(true);expect((screen.getByText('Delete permanently') as HTMLButtonElement).disabled).toBe(false);});
it('paginates with the sentinel excluded and preserves earlier metadata',async()=>{
 mocks.list.mockResolvedValueOnce(Array.from({length:51},(_,i)=>({...row,id:`entry${i}`,name:`Deleted ${i}`}))).mockResolvedValueOnce([{...row,id:'last',name:'Last deleted'}]);render(<TrashPanel actor="owner" onRestored={vi.fn()} onClose={vi.fn()}/>);await screen.findByText('Deleted 49');expect(screen.queryByText('Deleted 50')).toBeNull();fireEvent.click(screen.getByText('More deleted items'));await screen.findByText('Last deleted');expect(mocks.list).toHaveBeenLastCalledWith('owner',50);expect(screen.getByText('Deleted 0')).toBeTruthy();
});
it('ignores late metadata after unmount',async()=>{let resolve!:(rows:typeof row[])=>void;mocks.list.mockImplementationOnce(()=>new Promise(r=>resolve=r));const view=render(<TrashPanel actor="owner" onRestored={vi.fn()} onClose={vi.fn()}/>);view.unmount();await act(async()=>resolve([row]));expect(screen.queryByText('Deleted course')).toBeNull();});
it('prevents duplicate restore requests while one acknowledgment is pending',async()=>{
 await open();vi.spyOn(window,'confirm').mockReturnValue(true);let resolve!:(id:string)=>void;mocks.restore.mockImplementationOnce(()=>new Promise(r=>resolve=r));fireEvent.click(screen.getByText('Restore privately'));fireEvent.click(screen.getByText('Restore privately'));expect(mocks.restore).toHaveBeenCalledTimes(1);await act(async()=>resolve('root'));await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(2));
});
