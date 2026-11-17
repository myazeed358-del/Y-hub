import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { WorkbookStorageError } from '../integration/storageErrors';
import { sharingRepository as repo, type Share, type Person, type Permission } from './repository';
export function SharePanel({actor,id,name,onClose}:{actor:string;id:string;name:string;onClose:()=>void}) {
 const {language}=useLanguage(), ar=language==='ar',t=(en:string,arabic:string)=>ar?arabic:en;
 const [rows,setRows]=useState<Share[]>([]),[number,setNumber]=useState(''),[person,setPerson]=useState<Person|null>(null),[permission,setPermission]=useState<Permission>('view');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
 const alive=useRef(true),running=useRef(false);
 function report(e:unknown){setPerson(null);if(e instanceof WorkbookStorageError && e.kind==='session')setRows([]);setError(e instanceof WorkbookStorageError && e.kind==='conflict'?t('Sharing changed. Refresh and review before retrying.','تغيّرت المشاركة. حدّث القائمة وراجعها قبل إعادة المحاولة.'):t('Sharing unavailable. Check access and connection, then retry.','تعذرت المشاركة. تحقق من الصلاحية والاتصال ثم أعد المحاولة.'));}
 async function load(append=false){const result=await repo.shares(actor,id,append?rows.length:0);if(alive.current){setRows(old=>append?[...old,...result.slice(0,50)]:result.slice(0,50));setMore(result.length>50);}}
 async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)report(e);}finally{running.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;void run(()=>load());return()=>{alive.current=false;};},[actor,id]);
 const set=(p:Person,access:Permission,revision:number)=>run(async()=>{await repo.set(actor,id,p.id,access,revision);if(alive.current){setPerson(null);await load();}});
 return <section className="ys-directory-edit" aria-label={t('File sharing','مشاركة الملف')}>
  <h3>{t('Share','مشاركة')}: <bdi>{name}</bdi></h3>
  <p>{t('Only the selected account can view or edit. Shared access does not enable downloads or offline copies.','يمكن للحساب المحدد المشاهدة أو التحرير فقط. المشاركة لا تتيح التنزيل أو النسخ دون اتصال.')}</p>
  {error&&<p role="alert">{error}</p>}
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{const p=await repo.preview(actor,id,number);if(alive.current){setPerson(p);if(!p)setError(t('No matching account.','لا يوجد حساب مطابق.'));}});}}>
   <label>{t('Y-Hub number','رقم Y-Hub')} <input disabled={busy} value={number} maxLength={9} inputMode="numeric" onChange={e=>{setNumber(e.target.value);setPerson(null);}}/></label>
   <button disabled={busy||!/^\d{9}$/.test(number)}>{t('Find account','العثور على الحساب')}</button>
  </form>
  {person&&<div><p><bdi>{person.name}</bdi> · <bdi>{person.number}</bdi></p>
   <label>{t('Permission','الصلاحية')} <select value={permission} onChange={e=>setPermission(e.target.value as Permission)} disabled={busy}><option value="view">{t('View','مشاهدة')}</option><option value="edit">{t('Edit','تحرير')}</option></select></label>
   <button disabled={busy} onClick={()=>void set(person,permission,person.revision)}>{t('Confirm sharing with this account','تأكيد المشاركة مع هذا الحساب')}</button>
  </div>}
  <ul>{rows.map(row=><li key={row.id}><bdi>{row.name}</bdi> · <bdi>{row.number}</bdi>
   <select aria-label={`${t('Permission for','صلاحية')} ${row.number}`} value={row.permission} disabled={busy} onChange={e=>void set(row,e.target.value as Permission,row.revision)}>
    <option value="none">{t('Revoked','مسحوبة')}</option><option value="view">{t('View','مشاهدة')}</option><option value="edit">{t('Edit','تحرير')}</option>
   </select>
  </li>)}</ul>
  {more&&<button disabled={busy} onClick={()=>void run(()=>load(true))}>{t('More accounts','المزيد من الحسابات')}</button>}
  <button disabled={busy} onClick={()=>void run(()=>load())}>{t('Refresh sharing','تحديث المشاركة')}</button>
  <button onClick={onClose}>{t('Close sharing','إغلاق المشاركة')}</button>
 </section>;
}
