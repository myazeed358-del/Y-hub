import {useEffect,useRef,useState} from 'react';
import {useLanguage} from '@/i18n/LanguageContext';
import {directoryRepository as repo,type WorkbookPreviewData} from './directoryRepository';
/** Raw saved cells only. Never executes a formula, markup or a link. */
export function WorkbookPreview({owner,id,revision,onClose}:{owner:string;id:string;revision:number;onClose:()=>void}){
 const {language}=useLanguage(),ar=language==='ar',t=(en:string,a:string)=>ar?a:en;
 const [data,setData]=useState<WorkbookPreviewData|null>(null),[failed,setFailed]=useState(false),[busy,setBusy]=useState(true);
 const sequence=useRef(0);
 async function load(){const seq=++sequence.current;setData(null);setFailed(false);setBusy(true);
  try{const result=await repo.preview(owner,id,revision);if(seq===sequence.current)setData(result);}
  catch{if(seq===sequence.current)setFailed(true);}
  finally{if(seq===sequence.current)setBusy(false);}
 }
 useEffect(()=>{void load();const offline=()=>{sequence.current++;setData(null);setFailed(true);setBusy(false);};window.addEventListener('offline',offline);return()=>{sequence.current++;window.removeEventListener('offline',offline);};},[owner,id,revision]);
 return <section className="ys-cell-preview" aria-label={t('Saved cell preview','معاينة الخلايا المحفوظة')}>
  {busy&&<p role="status">{t('Loading preview…','جارٍ تحميل المعاينة…')}</p>}
  {failed&&<p role="alert">{t('Preview unavailable. Refresh the file list to check access and the latest saved version.','المعاينة غير متاحة. حدّث قائمة الملفات للتحقق من الوصول وآخر نسخة محفوظة.')}</p>}
  {data&&<><p><bdi>{data.sheetName}</bdi> · {data.sheetCount} {t('sheets','أوراق')} · A1:D6</p>
   <p>{t('Saved inputs; formulas appear as entered. Long cells are shortened.','المدخلات المحفوظة؛ تظهر المعادلات كما أُدخلت وتُختصر الخلايا الطويلة.')}</p>
   <table dir="ltr"><caption className="sr-only">{t('Saved cells A1 to D6','الخلايا المحفوظة من A1 إلى D6')}</caption>
    <thead><tr><th scope="col">#</th>{['A','B','C','D'].map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead>
    <tbody>{Array.from({length:6},(_,r)=><tr key={r}><th scope="row">{r+1}</th>{Array.from({length:4},(_,c)=>{const cell=data.cells.find(x=>x.row===r&&x.col===c);return <td key={c} dir="auto" title={cell?.text}>{cell?.text}{cell?.truncated?'…':''}</td>;})}</tr>)}</tbody>
   </table>
   {data.cells.every(c=>c.text==='')&&<p>{t('No saved inputs in this area.','لا توجد مدخلات محفوظة في هذه المساحة.')}</p>}
  </>}
  <button className="ys-secondary-button" onClick={onClose}>{t('Close preview','إغلاق المعاينة')}</button>
 </section>;
}
