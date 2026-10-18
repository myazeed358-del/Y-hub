import type { WorkbookData } from '../types/workbook';
import type { SaveCheckpoint } from '../integration/hostContract';
import { validateWorkbook } from './workbookValidation';
export interface PendingCellEdit { sheetId:string; row:number; col:number; raw:string }
export interface RecoveryRecord { version:1; ownerId:string; workbook:WorkbookData; checkpoint:SaveCheckpoint; updatedAt:string; draft?:PendingCellEdit }
export interface RecoveryEntry { key:string; encoded:string; record:RecoveryRecord }
/** Synchronous, per-account/per-editor records; no shared mutable index across tabs. */
export class RecoveryJournal {
  private prefix: string;
  private session = crypto.randomUUID();
  constructor(private ownerId:string, private storage:Storage) { this.prefix=`y-sheets-recovery:v1:${ownerId}:`; }
  private key(id:string) { return `${this.prefix}${this.session}:${id}`; }
  write(workbook:WorkbookData, checkpoint:SaveCheckpoint, draft?:PendingCellEdit):void {
    const record:RecoveryRecord={version:1,ownerId:this.ownerId,workbook,checkpoint,updatedAt:new Date().toISOString(),draft};
    const encoded=JSON.stringify(record);
    this.storage.setItem(this.key(workbook.id),encoded); // Throws; never erase old data or claim durability.
  }
  checkpoint(id:string, checkpoint:SaveCheckpoint):void {
    const current=this.storage.getItem(this.key(id));
    if (current) {
      const entry=this.decode(this.key(id),current);
      this.write(entry.record.workbook,checkpoint,entry.record.draft);
    } else if(checkpoint.intent) this.write(checkpoint.intent.workbook,checkpoint);
  }
  acknowledge(workbook:WorkbookData):void {
    const key=this.key(workbook.id),encoded=this.storage.getItem(key);
    if(!encoded) return;
    const record=this.decode(key,encoded).record;
    if(!record.draft && JSON.stringify(record.workbook)===JSON.stringify(validateWorkbook(workbook))) this.storage.removeItem(key);
  }
  removeUnchanged(entry:RecoveryEntry):void {
    if(entry.key.startsWith(this.prefix) && this.storage.getItem(entry.key)===entry.encoded) this.storage.removeItem(entry.key);
  }
  list():{entries:RecoveryEntry[]; corruptKeys:string[]} {
    const entries:RecoveryEntry[]=[],corruptKeys:string[]=[];
    for(let i=0;i<this.storage.length;i++) {
      const key=this.storage.key(i); if(!key?.startsWith(this.prefix)) continue;
      try { entries.push(this.decode(key,this.storage.getItem(key)!)); } catch { corruptKeys.push(key); }
    }
    return {entries:entries.sort((a,b)=>b.record.updatedAt.localeCompare(a.record.updatedAt)),corruptKeys};
  }
  private decode(key:string,encoded:string):RecoveryEntry {
    const r=JSON.parse(encoded) as RecoveryRecord;
    if(r.version!==1 || r.ownerId!==this.ownerId || !Number.isSafeInteger(r.checkpoint?.revision) || r.checkpoint.revision<0) throw new Error('Invalid recovery record.');
    r.workbook=validateWorkbook(r.workbook);
    if(r.checkpoint.intent) {
      r.checkpoint.intent.workbook=validateWorkbook(r.checkpoint.intent.workbook);
      if(r.checkpoint.intent.workbook.id!==r.workbook.id || !/^[a-f\d-]{36}$/i.test(r.checkpoint.intent.requestId)) throw new Error('Invalid pending save.');
    }
    if(r.draft) {
      const s=r.workbook.sheets.find(s=>s.id===r.draft!.sheetId),d=r.draft;
      if(!s || !Number.isInteger(d.row) || !Number.isInteger(d.col) || d.row<0 || d.col<0 || d.row>=s.rowCount || d.col>=s.colCount || typeof d.raw!=='string' || d.raw.length>32767) throw new Error('Invalid pending edit.');
    }
    return {key,encoded,record:r};
  }
}
