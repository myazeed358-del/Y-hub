import {useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {PolynomialTermBuilder} from './PolynomialTermBuilder';
import {writtenAnswerSyntax} from './writtenAnswerSyntax';

const symbols=[['x','x'],['t','t'],['+','+'],['−','-'],['×','*'],['x²','x^2'],['t²','t^2'],['^','^'],['+C','+C']] as const;

/** Input assistance only: server verification remains authoritative. */
export function WrittenAnswerInput({value,onChange,label,ar}:{value:string;onChange:(value:string)=>void;label:string;ar:boolean}){
 const id=useId(),input=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 const [tooLong,setTooLong]=useState(false);
 const syntax=useMemo(()=>writtenAnswerSyntax(value),[value]);
 useLayoutEffect(()=>{if(caret.current!==null&&input.current){input.current.focus();input.current.setSelectionRange(caret.current,caret.current);caret.current=null;}},[value]);
 function insert(text:string){
  const field=input.current;if(!field||field.matches(':disabled'))return;
  const start=field.selectionStart??value.length,end=field.selectionEnd??start;
  const next=value.slice(0,start)+text+value.slice(end);
  if(next.length>400){setTooLong(true);return;}
  setTooLong(false);
  if(next===value){field.focus();field.setSelectionRange(start+text.length,start+text.length);return;}
  caret.current=start+text.length;onChange(next);
 }
 return <div className="space-y-2">
  <input ref={input} aria-label={label} aria-describedby={`${id}-help${syntax!=='empty'?` ${id}-syntax`:''}${tooLong?` ${id}-limit`:''}`} dir="ltr" maxLength={400}
   className="w-full rounded border bg-background p-2" value={value}
   onChange={e=>{caret.current=null;setTooLong(false);onChange(e.target.value);}}/>
  <div role="group" aria-label={ar?'رموز كثيرات الحدود':'Polynomial symbols'} dir="ltr" className="flex flex-wrap gap-2">
   {symbols.map(([display,text])=><button key={display} type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-50"
    aria-label={`${ar?'إدراج':'Insert'} ${display}`} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(text)}>{display}</button>)}
  </div>
  <PolynomialTermBuilder ar={ar} onInsert={insert}/>
  {syntax!=='empty'&&<p id={`${id}-syntax`} role="status" className="rounded border p-2 text-xs" data-written-syntax={syntax}>
   {syntax==='supported'?(ar?'الصيغة قابلة للتحليل فقط؛ هذا ليس تصحيحًا للإجابة. تحقق من متغير السؤال، وتبقى النتيجة من الخادم.':'The syntax can be parsed; this is not an answer grade. Check the question’s variable; the server determines the result.'):
    (ar?'هذه الصيغة خارج نطاق المحلّل الحالي أو غير مكتملة. سيبقى نصك كما هو، ويمكن حفظه وإرساله للمراجعة دون احتسابه خطأ لمجرد الصيغة.':'This syntax is outside the current parser or incomplete. Your text is preserved and can be saved and submitted for review; syntax alone does not make the answer incorrect.')}
  </p>}
  <p id={`${id}-help`} className="text-xs">{ar?'هذه اللوحة لكثيرات الحدود فقط: استخدم متغير السؤال، ومعاملات صحيحة محدودة وأسّ صحيح من 0 إلى 8، و+C لعائلة التكامل. الكسور والجذور والدوال والأقواس خارج التصحيح المكتوب الحالي وتحتاج مراجعة.':'This palette is for polynomials only: use the question’s variable, bounded integer coefficients, integer powers from 0 to 8, and +C for integral families. Fractions, roots, functions and parentheses need review outside the current written verifier.'}</p>
  {tooLong&&<p id={`${id}-limit`} role="status" className="text-xs">{ar?'لم يُدرج الرمز: الحد الأقصى 400 حرف.':'Symbol not inserted: maximum 400 characters.'}</p>}
 </div>;
}
