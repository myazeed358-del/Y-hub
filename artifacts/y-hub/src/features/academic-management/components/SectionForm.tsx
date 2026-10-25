import { useState } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { CourseDefinition } from '@/shared/academic/contracts';
import { academicRepository } from '../services/repository';
import { useAcademicMutation } from '../hooks/useAcademicResource';
import { InstructorPicker } from './InstructorPicker';
export function SectionForm({ definition, userId, admin, ar, onSaved }: { definition: CourseDefinition; userId: string; admin: boolean; ar: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(() => ({ id: crypto.randomUUID(), definition: definition.id, instructor: admin ? '' : userId, label: '', term: '' }));
  const mutation = useAcademicMutation();
  return <form className="space-y-3 rounded-xl border bg-card p-4" onSubmit={async event => {
    event.preventDefault();
    if (await mutation.run(() => academicRepository.createSection(form))) {
      setForm({ ...form, id: crypto.randomUUID(), label: '' }); onSaved();
    }
  }}>
    <h2 className="font-bold">{ar ? 'شعبة جديدة:' : 'New section:'} {definition.title}</h2>
    <p>{definition.code} · {definition.academic_major || (ar ? 'مشترك' : 'Shared')}</p>
    {admin ? <InstructorPicker value={form.instructor} onChange={instructor => setForm({ ...form, instructor })} ar={ar} disabled={mutation.busy} />
      : <p>{ar ? 'ستُسند الشعبة إلى حسابك.' : 'This section will be assigned to you.'}</p>}
    <label className="block">{ar ? 'رقم/اسم الشعبة' : 'Section label'}<Input aria-label={ar ? 'رقم/اسم الشعبة' : 'Section label'} required maxLength={100} disabled={mutation.busy} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label>
    <label className="block">{ar ? 'الفصل الدراسي' : 'Academic term'}<Input aria-label={ar ? 'الفصل الدراسي' : 'Academic term'} required maxLength={100} disabled={mutation.busy} value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} /></label>
    <p>{ar ? 'تُنشأ الشعبة كمسودة والتسجيل مغلق؛ يمكن فتحهما من لوحة المساقات.' : 'Created as a draft with enrollment closed; use the course dashboard to open them.'}</p>
    {mutation.error && <p role="alert">{ar ? 'لم يُؤكد إنشاء الشعبة؛ أعد المحاولة بنفس البيانات.' : 'Section creation not confirmed; retry with the same input.'}</p>}
    <Button disabled={mutation.busy}>{ar ? 'إنشاء الشعبة' : 'Create section'}</Button>
  </form>;
}
