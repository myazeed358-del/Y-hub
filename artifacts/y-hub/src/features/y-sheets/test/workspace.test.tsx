import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbookWorkspace } from '../workspace/useWorkbookWorkspace';
import { RecoveryJournal } from '../io/recoveryJournal';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { WorkbookStorageError } from '../integration/storageErrors';
const mocks=vi.hoisted(() => ({load:vi.fn(),save:vi.fn(),list:vi.fn(),restore:vi.fn()}));
vi.mock('../integration/supabaseWorkbookStorage', () => ({createSupabaseWorkbookStorage:() => ({
  loadWorkbook:mocks.load,saveWorkbook:mocks.save,listWorkbooks:mocks.list,checkpoint:() => ({revision:4}),restoreCheckpoint:mocks.restore,
})}));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  mocks.list.mockResolvedValue([]); mocks.load.mockResolvedValue(createDefaultWorkbook()); mocks.save.mockResolvedValue(undefined);
});
afterEach(cleanup);
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
