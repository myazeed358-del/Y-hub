import {Button} from '@workspace/y-hub-ds/components/ui/button';
import type {QuickAccessController} from '../hooks/useQuickAccess';
export function QuickAccessEditor({state,language}:{state:QuickAccessController;language:'ar'|'en'}){
 const ar=language==='ar';
 const swap=(index:number,delta:number)=>{const next=[...state.draft];[next[index],next[index+delta]]=[next[index+delta],next[index]];state.setDraft(next);};
 return <div className="mt-3 space-y-3">
  {state.loading&&<p role="status" className="text-sm">{ar?'جارٍ تحميل تفضيلاتك…':'Loading your preferences…'}</p>}
  {state.error&&<p role="alert" className="text-sm text-destructive">{ar?'لم يتأكد الحفظ أو التحميل. احتُفظ باختياراتك؛ حدّث وقارن قبل الحفظ مجددًا.':'Save or load was not confirmed. Your selection is retained; refresh and compare before saving again.'}</p>}
  {state.changedElsewhere&&<p role="status" className="text-sm">{ar?'تغيرت التفضيلات على جهاز آخر.':'Preferences changed on another device.'}</p>}
  {state.invalidSelection&&<p role="alert" className="text-sm">{ar?'أزل الأدوات التي لم تعد متاحة قبل الحفظ.':'Remove tools that are no longer available before saving.'}</p>}
  {!state.editing?<Button variant="outline" size="sm" disabled={state.loading} onClick={state.begin}>{ar?'تخصيص الأدوات':'Customize tools'}</Button>:<>
   <p className="text-sm text-muted-foreground">{ar?'اختر من صفر إلى ثلاث أدوات.':'Choose zero to three tools.'}</p>
   {state.draft.map((path,index)=><div key={index} className="space-y-1">
    <select aria-label={`${ar?'الأداة':'Tool'} ${index+1}`} value={path} disabled={state.busy} className="w-full border border-border rounded-md bg-background p-2 text-sm" onChange={e=>state.setDraft(state.draft.map((p,i)=>i===index?e.target.value:p))}>
     {!state.available.some(a=>a.path===path)&&<option value={path}>{ar?'غير متاحة':'Unavailable'}: {path}</option>}
     {state.available.filter(a=>a.path===path||!state.draft.includes(a.path)).map(a=><option key={a.path} value={a.path}>{a.title[language]}</option>)}
    </select>
    <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={state.busy||index===0} onClick={()=>swap(index,-1)}>{ar?'أعلى':'Up'}</Button><Button size="sm" variant="ghost" disabled={state.busy||index===state.draft.length-1} onClick={()=>swap(index,1)}>{ar?'أسفل':'Down'}</Button><Button size="sm" variant="ghost" disabled={state.busy} onClick={()=>state.setDraft(state.draft.filter((_,i)=>i!==index))}>{ar?'إزالة':'Remove'}</Button></div>
   </div>)}
   <div className="flex flex-wrap gap-2">
    <Button size="sm" variant="outline" disabled={state.busy||state.draft.length>=3||!state.available.some(a=>!state.draft.includes(a.path))} onClick={()=>{const next=state.available.find(a=>!state.draft.includes(a.path));if(next)state.setDraft([...state.draft,next.path]);}}>{ar?'إضافة':'Add'}</Button>
    <Button size="sm" disabled={state.busy||state.invalidSelection} onClick={()=>void state.save()}>{ar?'حفظ':'Save'}</Button>
    <Button size="sm" variant="ghost" disabled={state.busy} onClick={state.cancel}>{ar?'إلغاء':'Cancel'}</Button>
    <Button size="sm" variant="outline" disabled={state.busy} onClick={()=>{if(window.confirm(ar?'استبدال الاختيارات غير المحفوظة بآخر نسخة محمّلة من الحساب؟':'Replace unsaved selection with the latest loaded account preferences?'))state.reload();}}>{ar?'استخدام نسخة الحساب':'Use account version'}</Button>
   </div>
  </>}
  {state.error&&<Button size="sm" variant="outline" disabled={state.busy} onClick={()=>void state.refresh()}>{ar?'تحديث':'Refresh'}</Button>}
 </div>;
}
