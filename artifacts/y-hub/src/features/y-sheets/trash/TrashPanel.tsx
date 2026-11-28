import { useEffect,useRef,useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { trashRepository as repo,type TrashEntry } from './repository';
export function TrashPanel({actor,onRestored,onClose}:{actor:string;onRestored:()=>void;onClose:()=>void}) {
 const {language}=useLanguage(),ar=language==='ar',t=(en:string,a:string)=>ar?a:en;
 const [rows,setRows]=useState<TrashEntry[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const alive=useRef(true),sequence=useRef(0),working=useRef(false);
 async function load(append=false){
  const seq=++sequence.current;setBusy(true);setError(false);if(!append)setRows([]);
  try{const data=await repo.list(actor,append?rows.length:0);if(alive.current&&seq===sequence.current){setRows(old=>append?[...old,...data.slice(0,50)]:data.slice(0,50));setMore(data.length>50);}}
  catch{if(alive.current&&seq===sequence.current){setRows([]);setMore(false);setError(true);}}
  finally{if(alive.current&&seq===sequence.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void load();const focus=()=>{if(!working.current)void load();};window.addEventListener('focus',focus);return()=>{alive.current=false;sequence.current++;window.removeEventListener('focus',focus);};},[actor]);
 async function change(row:TrashEntry,restore:boolean){
  if(working.current||busy)return;
  const message=restore?t('Restore this item and its internal tree privately in My files? Previous shares remain revoked. Review and enable them manually.','هل تريد استعادة العنصر وشجرته الداخلية بشكل خاص في ملفاتي؟ تبقى المشاركات السابقة مسحوبة، وتراجعها وتفعّلها يدويًا.')
   :t('Permanently delete this item and all archived contents? This cannot be undone.','هل تريد حذف العنصر وجميع محتوياته المؤرشفة نهائيًا؟ لا يمكن التراجع.');
  if(!window.confirm(message))return;
  working.current=true;setBusy(true);setError(false);
  try{if(restore)await repo.restore(actor,row.id);else await repo.purge(actor,row.id);if(alive.current){if(restore)onRestored();await load();}}
  catch{if(alive.current){setRows([]);setError(true);setMore(false);}}
  finally{working.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="ys-directory-edit" aria-label={t('Trash','سلة المحذوفات')}>
  <h3>{t('Trash — 30 days','سلة المحذوفات — 30 يومًا')}</h3>
  <p>{t('Deleted items cannot be opened or shared. Restore before the expiry date; restored items return privately to My files with their internal folder tree.','لا يمكن فتح العناصر المحذوفة أو مشاركتها. استعدها قبل تاريخ الانتهاء؛ تعود خاصةً إلى ملفاتي مع شجرة المجلدات الداخلية.')}</p>
  {error&&<p role="alert">{t('Trash could not be updated. The item may have changed or expired. Refresh and review before retrying.','تعذر تحديث السلة. ربما تغيّر العنصر أو انتهت مهلته. حدّث وراجع قبل إعادة المحاولة.')}</p>}
  {busy&&<p role="status">{t('Updating trash…','جارٍ تحديث السلة…')}</p>}
  {!busy&&!error&&rows.length===0&&<p>{t('Trash is empty.','سلة المحذوفات فارغة.')}</p>}
  <ul>{rows.map(row=><li key={row.id}><bdi>{row.name}</bdi> · {row.fileCount} {t('files','ملفات')} · {row.folderCount} {t('folders','مجلدات')}
   <p>{t('Expires','تنتهي المهلة')}: <time dateTime={row.expiresAt}>{new Intl.DateTimeFormat(ar?'ar-JO':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.expiresAt))}</time></p>
   <button disabled={busy||Date.now()>=Date.parse(row.expiresAt)} onClick={()=>void change(row,true)}>{t('Restore privately','استعادة خاصة')}</button>
   <button disabled={busy} onClick={()=>void change(row,false)}>{t('Delete permanently','حذف نهائي')}</button>
  </li>)}</ul>
  {more&&<button disabled={busy} onClick={()=>void load(true)}>{t('More deleted items','المزيد من المحذوفات')}</button>}
  <button disabled={busy} onClick={()=>void load()}>{t('Refresh trash','تحديث السلة')}</button>
  <button disabled={busy} onClick={onClose}>{t('Close trash','إغلاق السلة')}</button>
 </section>;
}
