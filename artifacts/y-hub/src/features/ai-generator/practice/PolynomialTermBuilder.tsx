import {useId,useState} from 'react';

/** Visual construction of a single supported monomial; no answer evaluation. */
export function PolynomialTermBuilder({ar,onInsert}:{ar:boolean;onInsert:(text:string)=>void}){
 const id=useId(),[coefficient,setCoefficient]=useState('1'),[variable,setVariable]=useState('x'),[degree,setDegree]=useState('1');
 const normalized=coefficient.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/−/g,'-');
 const number=Number(normalized),valid=/^[+-]?\d{1,3}$/.test(normalized)&&Number.isInteger(number)&&Math.abs(number)<=800&&(variable==='x'||variable==='t')&&/^[0-8]$/.test(degree);
 const expression=number===0||degree==='0'?String(number):`${number}*${variable}${degree==='1'?'':`^${degree}`}`;
 return <details className="rounded border p-2">
  <summary className="cursor-pointer text-sm">{ar?'بناء حدّ رياضي':'Build a polynomial term'}</summary>
  <div className="mt-2 space-y-2">
   <div className="flex flex-wrap gap-2">
    <div className="min-w-0 flex-1 text-sm"><label htmlFor={`${id}-coefficient`}>{ar?'المعامل الصحيح':'Integer coefficient'}</label>
     <input id={`${id}-coefficient`} value={coefficient} dir="ltr" maxLength={8} aria-invalid={!valid} aria-describedby={`${id}-limits`}
      className="block w-full min-w-20 rounded border bg-background p-2" onChange={e=>setCoefficient(e.target.value)}/></div>
    <div className="text-sm"><label htmlFor={`${id}-variable`}>{ar?'المتغير':'Variable'}</label>
     <select id={`${id}-variable`} value={variable} className="block rounded border bg-background p-2" onChange={e=>setVariable(e.target.value)}><option>x</option><option>t</option></select></div>
    <div className="text-sm"><label htmlFor={`${id}-degree`}>{ar?'الأسّ':'Power'}</label>
     <select id={`${id}-degree`} value={degree} className="block rounded border bg-background p-2" onChange={e=>setDegree(e.target.value)}>{Array.from({length:9},(_,i)=><option key={i} value={i}>{i}</option>)}</select></div>
   </div>
   <p id={`${id}-limits`} className="text-xs">{ar?'المعامل من −800 إلى 800، والأسّ من 0 إلى 8. اختر متغير السؤال واستخدم + أو − بين الحدود.':'Coefficient: −800 to 800; power: 0 to 8. Use the question’s variable and + or − between terms.'}</p>
   {valid?<div role="img" aria-label={`${ar?'معاينة الحد':'Term preview'}: ${expression}`} dir="ltr" className="rounded border p-2 text-lg">
    {number}{number!==0&&degree!=='0'&&<> × {variable}{degree!=='1'&&<sup>{degree}</sup>}</>}
   </div>:<p role="status" className="text-xs">{ar?'أدخل معاملًا صحيحًا من −800 إلى 800؛ لا تُقرّب الكسور تلقائيًا.':'Enter an integer coefficient from −800 to 800; fractions are not rounded automatically.'}</p>}
   <button type="button" disabled={!valid} className="rounded border px-3 py-2 text-sm disabled:opacity-50"
    onClick={e=>{if(valid&&!e.currentTarget.matches(':disabled'))onInsert(expression);}}>{ar?'إدراج الحدّ':'Insert term'}</button>
  </div>
 </details>;
}
