import { useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { majorLabels } from '@/i18n/profileLabels';
import { academicRepository } from '../services/repository';
import { useAcademicMutation } from '../hooks/useAcademicResource';
const empty = () => ({ id: crypto.randomUUID(), title: '', code: '', description: '', department: '', major: '' });
export function DefinitionForm({ ar, onSaved }: { ar: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(empty);
  const mutation = useAcademicMutation();
  const fields = [['title', ar ? 'اسم المادة' : 'Definition title'], ['code', ar ? 'رمز المادة' : 'Course code'],
    ['department', ar ? 'القسم الأكاديمي' : 'Department'], ['description', ar ? 'الوصف' : 'Description']] as const;
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={async event => {
    event.preventDefault();
    if (await mutation.run(() => academicRepository.createDefinition(form))) { setForm(empty()); onSaved(); }
  }}>
    <h2 className="font-bold">{ar ? 'تعريف مادة جديدة' : 'New course definition'}</h2>
    {fields.map(([key, label]) => <label className="block" key={key}>{label}<Input aria-label={label} required={key === 'title'}
      maxLength={key === 'description' ? 4000 : key === 'code' ? 100 : 200} disabled={mutation.busy} value={form[key]}
      onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}
    <label className="block">{ar ? 'التخصص' : 'Academic major'}<select aria-label="Academic major" className="w-full border bg-background p-2" disabled={mutation.busy}
      value={form.major} onChange={event => setForm({ ...form, major: event.target.value })}>
      <option value="">{ar ? 'مشترك — جميع التخصصات' : 'Shared — all majors'}</option>
      {Object.entries(majorLabels).map(([key, label]) => <option key={key} value={key}>{ar ? label.ar : label.en}</option>)}
    </select></label>
    {mutation.error && <p role="alert">{ar ? 'لم يُؤكد الحفظ؛ احتفظنا بالبيانات لإعادة المحاولة.' : 'Save not confirmed; your input is preserved for retry.'}</p>}
    <Button disabled={mutation.busy}>{ar ? 'حفظ تعريف المادة' : 'Save definition'}</Button>
  </form>;
}
