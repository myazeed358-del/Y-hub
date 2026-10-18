import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbookWorkspace } from '../workspace/useWorkbookWorkspace';
import { RecoveryJournal } from '../io/recoveryJournal';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { WorkbookStorageError } from '../integration/storageErrors';
const mocks=vi.hoisted(() => ({load:vi.fn(),save:vi.fn(),list:vi.fn(),restore:vi.fn(),remove:vi.fn()}));
vi.mock('../integration/supabaseWorkbookStorage', () => ({createSupabaseWorkbookStorage:() => ({
  loadWorkbook:mocks.load,saveWorkbook:mocks.save,listWorkbooks:mocks.list,checkpoint:() => ({revision:4}),restoreCheckpoint:mocks.restore,deleteWorkbook:mocks.remove,
})}));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  mocks.list.mockResolvedValue([]); mocks.load.mockResolvedValue(createDefaultWorkbook()); mocks.save.mockResolvedValue(undefined);
});
afterEach(() => {cleanup(); vi.restoreAllMocks();});
describe('workspace recovery integration', () => {
  it('does not open a default workbook after a failed cloud load', async () => {
    mocks.load.mockRejectedValue(Error('Offline'));
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.open('missing'); });
    expect(result.current.active).toBeNull(); expect(result.current.error).toBe('Offline');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('offers local recovery even when the server list is unavailable', async () => {
    new RecoveryJournal('owner',localStorage).write(createDefaultWorkbook(),{revision:2});
    mocks.list.mockRejectedValue(Error('Offline'));
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await waitFor(() => expect(result.current.recoveries).toHaveLength(1));
    expect(result.current.active).toBeNull();
    const entry=result.current.recoveries[0]!;
    await act(async () => { await result.current.restore(entry); });
    expect(mocks.restore).toHaveBeenCalledWith(entry.record.workbook.id,{revision:2});
    expect(result.current.active?.id).toBe(entry.record.workbook.id);
  });
  it('retains edits after a CAS conflict and refuses unsafe file navigation', async () => {
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.open('first'); });
    mocks.save.mockRejectedValue(new WorkbookStorageError('conflict','Newer version exists'));
    await act(async () => { await result.current.change({...createDefaultWorkbook(),name:'Must survive'}); await result.current.myFiles(); });
    expect(result.current.active).not.toBeNull(); expect(result.current.status).toBe('conflict');
    expect(new RecoveryJournal('owner',localStorage).list().entries.some(e => e.record.workbook.name==='Must survive')).toBe(true);
    await act(async () => { await result.current.keepAndLeave(); });
    expect(result.current.active).toBeNull();
    expect(result.current.recoveries).toHaveLength(1);
  });
  it('keeps a draft across unmount and does not leak it to another account', async () => {
    const {result,unmount}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.open('first'); });
    act(() => result.current.draft({sheetId:createDefaultWorkbook().activeSheetId,row:0,col:0,raw:'Uncommitted'}));
    unmount();
    const next=renderHook(() => useWorkbookWorkspace('different-owner'));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(next.result.current.recoveries).toHaveLength(0);
    expect(new RecoveryJournal('owner',localStorage).list().entries[0]!.record.draft?.raw).toBe('Uncommitted');
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe('file management', () => {
  it('renames through the revision-checked save path', async () => {
    vi.spyOn(window,'prompt').mockReturnValue('Renamed');
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.rename('file'); });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({name:'Renamed'}));
  });
  it('requires confirmation and sends the displayed revision when deleting', async () => {
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.remove({id:'file',name:'Delete me',revision:8}); });
    expect(mocks.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => { await result.current.remove({id:'file',name:'Delete me',revision:8}); });
    expect(mocks.remove).toHaveBeenCalledWith('file',8);
  });
  it('retains the list and reports an unconfirmed delete', async () => {
    vi.spyOn(window,'confirm').mockReturnValue(true);
    mocks.list.mockResolvedValue([{id:'file',name:'Keep',revision:8}]);
    mocks.remove.mockRejectedValue(Error('Delete was not confirmed'));
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    await act(async () => { await result.current.remove(result.current.files[0]!); });
    expect(result.current.files).toHaveLength(1); expect(result.current.error).toContain('not confirmed');
  });
  it('blocks destructive operations when a local recovery exists', async () => {
    const wb=createDefaultWorkbook();
    new RecoveryJournal('owner',localStorage).write(wb,{revision:2});
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await act(async () => { await result.current.remove({id:wb.id,name:wb.name,revision:2}); });
    expect(mocks.remove).not.toHaveBeenCalled(); expect(result.current.error).toContain('local edits');
  });
  it('searches on the server and requests additional pages', async () => {
    const files=Array.from({length:50},(_,i) => ({id:String(i),name:'File '+i,updatedAt:''}));
    mocks.list.mockResolvedValue(files);
    const {result}=renderHook(() => useWorkbookWorkspace('owner'));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.searchFiles('budget'); });
    expect(mocks.list).toHaveBeenLastCalledWith({search:'budget'});
    mocks.list.mockResolvedValue([{id:'50',name:'Last',updatedAt:''}]);
    await act(async () => { await result.current.more(); });
    expect(mocks.list).toHaveBeenLastCalledWith({search:'budget',offset:50});
    expect(result.current.files).toHaveLength(51); expect(result.current.hasMore).toBe(false);
  });
});
