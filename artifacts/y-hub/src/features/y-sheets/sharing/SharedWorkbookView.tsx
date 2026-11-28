import { useEffect,useRef,useState } from 'react';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigationGuard } from '@/shared/navigation/guardedLocation';
import { YSheetsHostAdapter } from '../integration/YSheetsHostAdapter';
import { WorkbookSaveCoordinator,type SaveStatus } from '../integration/saveCoordinator';
import { WorkbookStorageError } from '../integration/storageErrors';
import type { WorkbookData, PendingCellEdit } from '../types/workbook';
import { sharingRepository as repo } from './repository';
/** Shared content never enters WorkbookSession, RecoveryJournal or local storage. */
export function SharedWorkbookView({actor,id,onClose}:{actor:string;id:string;onClose:()=>void}){
 const {language}=useLanguage(),ar=language==='ar',t=(en:string,a:string)=>ar?a:en;const {resolvedTheme}=useTheme();
 const [data,setData]=useState<{workbook:WorkbookData;permission:'view'|'edit'}|null>(null),[closed,setClosed]=useState(false),[status,setStatus]=useState<SaveStatus>('saved');
 const coordinator=useRef<WorkbookSaveCoordinator|null>(null),draft=useRef<PendingCellEdit | null>(null),valid=useRef(false);
 const dirty=()=>draft.current||!!coordinator.current?.hasUnsavedChanges;
 const mayLeave=()=>!dirty()||window.confirm(t('Discard unsaved shared edits and leave? No local recovery copy is kept.','هل تريد تجاهل تعديلات الملف المشترك غير المحفوظة والمغادرة؟ لا تُحفظ نسخة استعادة محلية.'));
 useNavigationGuard(mayLeave);
 useEffect(()=>{
  let alive=true,epoch=0;valid.current=false;setData(null);setClosed(false);draft.current=null;
  const invalidate=()=>{epoch++;valid.current=false;coordinator.current?.dispose();coordinator.current=null;draft.current=null;if(alive){setData(null);setClosed(true);}};
  let grant=0,revision=0;
  const check=async()=>{if(!valid.current)return;try{await repo.read(actor,id,grant,false);}catch{invalidate();}};
  const start=epoch;
  void repo.read(actor,id).then(loaded=>{
   if(!alive||epoch!==start||!loaded.workbook)return;
   grant=loaded.grantRevision;revision=loaded.revision;valid.current=true;
   coordinator.current=new WorkbookSaveCoordinator(async workbook=>{
    if(!valid.current)throw new WorkbookStorageError('session','Access unavailable');
    try{revision=await repo.save(actor,id,grant,crypto.randomUUID(),revision,workbook);}
    catch(e){if(e instanceof WorkbookStorageError&&e.kind==='conflict')throw e;invalidate();throw new WorkbookStorageError('session','Shared access unavailable');}
   },next=>{if(alive&&valid.current)setStatus(next==='saved'&&draft.current?'unsaved':next);});
   setData({workbook:loaded.workbook,permission:loaded.permission});setStatus('saved');
  }).catch(()=>invalidate());
  const offline=()=>invalidate(),focus=()=>void check(),visibility=()=>{if(document.visibilityState==='visible')void check();};
  const timer=setInterval(()=>void check(),15000);
  const unload=(e:BeforeUnloadEvent)=>{if(dirty()){e.preventDefault();e.returnValue='';}};
  window.addEventListener('offline',offline);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);window.addEventListener('beforeunload',unload);
  return()=>{alive=false;invalidate();clearInterval(timer);window.removeEventListener('offline',offline);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('beforeunload',unload);};
 },[actor,id]);
 return <div className="y-sheets-workspace-editor" dir="ltr" onCopyCapture={e=>e.preventDefault()} onCutCapture={e=>e.preventDefault()}>
  <div className="ys-directory-edit" dir={ar?'rtl':'ltr'}>
   <button className="ys-secondary-button" onClick={()=>{if(mayLeave())onClose();}}>{t('Back to my files','العودة إلى ملفاتي')}</button>
   <p>{t('Shared file: no downloads or local recovery. Access is checked on every save and periodically while open.','ملف مشترك: لا تنزيل أو استعادة محلية. تُفحص الصلاحية عند كل حفظ ودوريًا أثناء الفتح.')}</p>
   {data&&<><span role="status" data-shared-save={status}>{status==='conflict'?t('Save conflict. Reopen the file to review the latest version.','تعارض حفظ. أعد فتح الملف لمراجعة النسخة الأحدث.'):status==='saved'?t('Saved','محفوظ'):t('Unsaved or saving','غير محفوظ أو جارٍ الحفظ')}</span>
    {data.permission==='edit'&&<button className="ys-secondary-button" onClick={()=>{if(!draft.current)void coordinator.current?.flush().catch(()=>{});}}>{t('Save shared file','حفظ الملف المشترك')}</button>}</>}
   {closed&&<p role="alert">{t('Shared access could not be verified. The file was closed and no local recovery was retained. Reopen it when access is available to see the latest saved version.','تعذر التحقق من الوصول. أُغلق الملف دون الاحتفاظ باستعادة محلية. أعد فتحه عند توفر الوصول لرؤية آخر نسخة محفوظة.')}</p>}
   {!data&&!closed&&<p role="status">{t('Loading…','جارٍ التحميل…')}</p>}
  </div>
  {data&&<YSheetsHostAdapter key={`${actor}:${id}`} user={{id:actor,name:''}} initialWorkbook={data.workbook} allowNewWorkbook={false} allowRenameWorkbook={false} theme={resolvedTheme==='dark'?'dark':'light'}
   permissions={{canEdit:data.permission==='edit',canExport:false,canCreateSheet:data.permission==='edit',canDeleteSheet:data.permission==='edit',canFormat:data.permission==='edit'}}
   onSave={async workbook=>{if(valid.current&&data.permission==='edit'){const pending=draft.current;if(pending&&workbook.sheets.find(s=>s.id===pending.sheetId)?.cells[`${pending.row},${pending.col}`]?.raw===pending.raw)draft.current=null;coordinator.current?.enqueue(workbook);}}}
   onDraftChange={edit=>{draft.current=edit;setStatus(edit?'unsaved':coordinator.current?.status??'saved');}}/>
  }
 </div>;
}
