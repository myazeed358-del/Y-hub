import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoveryJournal } from '../io/recoveryJournal';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { WorkbookSession } from '../integration/workbookSession';
import { validateWorkbook } from '../io/workbookValidation';
import type { HostStorageAdapter } from '../integration/hostContract';

beforeEach(() => localStorage.clear());
const workbook = () => validateWorkbook(createDefaultWorkbook());
describe('durable recovery', () => {
  it('survives refresh and isolates accounts and simultaneous editors', () => {
    const first = new RecoveryJournal('a',localStorage), second = new RecoveryJournal('a',localStorage);
    first.write(workbook(),{revision:2});
    second.write({...workbook(),name:'Other tab'},{revision:2});
    expect(new RecoveryJournal('a',localStorage).list().entries).toHaveLength(2);
    expect(new RecoveryJournal('b',localStorage).list().entries).toHaveLength(0);
    first.acknowledge(workbook());
    expect(second.list().entries.map(e => e.record.workbook.name)).toEqual(['Other tab']);
  });
  it('does not erase newer edits or a pending keystroke when an older save succeeds', () => {
    const journal = new RecoveryJournal('a',localStorage), old = workbook(), newer = {...old,name:'New'};
    journal.write(newer,{revision:2}); journal.acknowledge(old);
    expect(journal.list().entries).toHaveLength(1);
    journal.write(old,{revision:2},{sheetId:old.activeSheetId,row:0,col:0,raw:'unsent'});
    journal.acknowledge(old);
    expect(journal.list().entries[0]!.record.draft?.raw).toBe('unsent');
  });
  it('preserves exact pending request identity after refresh', () => {
    const journal = new RecoveryJournal('a',localStorage), wb = workbook();
    const cp = {revision:3,intent:{requestId:crypto.randomUUID(),workbook:wb}};
    journal.checkpoint(wb.id,cp);
    expect(new RecoveryJournal('a',localStorage).list().entries[0]!.record.checkpoint).toEqual(cp);
  });
  it('retains corrupt entries and refuses to erase changed recovery records', () => {
    const journal = new RecoveryJournal('a',localStorage);
    journal.write(workbook(),{revision:1});
    const entry = journal.list().entries[0]!;
    localStorage.setItem(entry.key,'corrupt');
    journal.removeUnchanged(entry);
    expect(journal.list().corruptKeys).toEqual([entry.key]);
    expect(localStorage.getItem(entry.key)).toBe('corrupt');
  });
  it('keeps memory and blocks cloud writes on local storage failure', async () => {
    const journal = new RecoveryJournal('a',localStorage), save = vi.fn();
    const storage = {saveWorkbook:save,checkpoint:() => ({revision:1})} as unknown as HostStorageAdapter;
    const session = new WorkbookSession(workbook(),storage,journal,vi.fn());
    const write = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw Error('Quota exceeded'); });
    const changed = {...workbook(),name:'Irreplaceable'};
    expect(() => session.change(changed)).toThrow('Quota');
    expect(session.recoveryCopy().name).toBe('Irreplaceable');
    expect(save).not.toHaveBeenCalled();
    write.mockRestore();
    await session.flush();
    expect(save).toHaveBeenCalledTimes(1);
    session.dispose();
  });
  it('retains failed saves and blocks file switches during a draft', async () => {
    const journal = new RecoveryJournal('a',localStorage), wb = workbook();
    const storage = {saveWorkbook:vi.fn(),checkpoint:() => ({revision:1})} as unknown as HostStorageAdapter;
    const session = new WorkbookSession(wb,storage,journal,vi.fn());
    session.editDraft({sheetId:wb.activeSheetId,row:0,col:0,raw:'typed before refresh'});
    await expect(session.flush()).rejects.toThrow('Finish or cancel');
    expect(session.recoveryCopy().sheets[0]!.cells['0,0']!.raw).toBe('typed before refresh');
    session.dispose();
    expect(new RecoveryJournal('a',localStorage).list().entries[0]!.record.draft?.raw).toBe('typed before refresh');
  });
});
