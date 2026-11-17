import { useEffect,useRef,useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { sharingRepository as repo,type Incoming } from './repository';
export function SharedFiles({actor,onOpen}:{actor:string;onOpen:(id:string)=>void}){
 const {language}=useLanguage(),ar=language==='ar';const [rows,setRows]=useState<Incoming[]>([]),[error,setError]=useState(false),[busy,setBusy]=useState(false),[more,setMore]=useState(false);const sequence=useRef(0);
 async function load(append=false){const seq=++sequence.current;setBusy(true);setError(false);if(!append)setRows([]);try{const data=await repo.incoming(actor,append?rows.length:0);if(seq===sequence.current){setRows(old=>append?[...old,...data.slice(0,50)]:data.slice(0,50));setMore(data.length>50);}}catch{if(seq===sequence.current){setRows([]);setMore(false);setError(true);}}finally{if(seq===sequence.current)setBusy(false);}}
 useEffect(()=>{void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>{sequence.current++;window.removeEventListener('focus',focus);};},[actor]);
 return <section className="ys-browser" aria-label={ar?'تمت مشاركتها معي':'Shared with me'}><h2>{ar?'تمت مشاركتها معي':'Shared with me'}</h2>
 {error&&<p role="alert">{ar?'تعذر تحديث المشاركات.':'Unable to refresh shared files.'}</p>}
 <button className="ys-secondary-button" disabled={busy} onClick={()=>void load()}>{ar?'تحديث المشاركات':'Refresh shared files'}</button>
 {!busy&&!error&&rows.length===0&&<p>{ar?'لا توجد ملفات مشتركة.':'No shared files.'}</p>}
 <ul>{rows.map(r=><li key={r.id}><button disabled={busy} onClick={()=>onOpen(r.id)}><bdi>{r.name}</bdi> · <bdi>{r.ownerName}</bdi> · {r.permission==='edit'?(ar?'تحرير':'Edit'):(ar?'مشاهدة':'View')}</button></li>)}</ul>
 {more&&<button disabled={busy} onClick={()=>void load(true)}>{ar?'تحميل المزيد':'Load more shared files'}</button>}
 </section>;
}
