import {SectionActivityLinks} from '@/shared/academic/SectionActivityLinks';
import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import type { CourseSection } from '@/shared/academic/contracts';
import { courseEnrollmentRepository } from '@/shared/academic/enrollmentRepository';
import { academicRepository } from '../services/repository';
import { useAcademicResource, useAcademicMutation } from '../hooks/useAcademicResource';
import { InstructorPicker } from './InstructorPicker';
function Assignment({ section, ar, onSaved }: { section: CourseSection; ar: boolean; onSaved: () => void }) {
  const [instructor, setInstructor] = useState(''); const mutation = useAcademicMutation();
  return <form className="mt-3 space-y-2" onSubmit={async e => {
    e.preventDefault();
    if (!window.confirm(ar ? 'تغيير الدكتور المكلّف بهذه الشعبة؟' : 'Change this section’s assigned instructor?')) return;
    if (await mutation.run(() => academicRepository.assign(section, instructor))) { setInstructor(''); onSaved(); }
  }}>
    <InstructorPicker value={instructor} onChange={setInstructor} ar={ar} disabled={mutation.busy} />
    {mutation.error && <p role="alert">{ar ? 'لم يُؤكد الإسناد. حدّث القائمة قبل إعادة المحاولة.' : 'Assignment not confirmed. Reload before retrying.'}</p>}
    <Button disabled={mutation.busy || !instructor}>{ar ? 'إسناد الدكتور' : 'Assign instructor'}</Button>
  </form>;
}
function Roster({ id, ar }: { id: string; ar: boolean }) {
  const state = useAcademicResource(id, () => courseEnrollmentRepository.getRoster(id));
  if (state.loading) return <p role="status">…</p>;
  if (state.error) return <p role="alert">{ar ? 'تعذر عرض الطلاب أو لا تملك الصلاحية.' : 'Unable to load roster or access denied.'}</p>;
  return <div className="mt-2 overflow-auto"><p>{ar ? 'الطلاب المسجلون:' : 'Enrolled students:'} {state.data?.length}</p>
    <table className="w-full text-start"><thead><tr><th>{ar ? 'الاسم' : 'Name'}</th><th>{ar ? 'الرقم الجامعي' : 'Student number'}</th></tr></thead>
      <tbody>{state.data?.map(student => <tr key={student.student_id}><td>{student.full_name}</td><td>{student.user_number || '—'}</td></tr>)}</tbody>
    </table></div>;
}
export function SectionList({ sections, admin, userId, ar, revision, onSaved }: { sections: CourseSection[]; admin: boolean; userId: string; ar: boolean; revision: number; onSaved: () => void }) {
  const [roster, setRoster] = useState<string | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  const counts = useAcademicResource(String(revision), () => courseEnrollmentRepository.listCounts());
  return <div className="space-y-3">{counts.error && <p role="alert">{ar ? 'تعذر تحميل الأعداد' : 'Unable to load enrollment counts'}</p>}
    {sections.map(section => <article className="rounded-xl border bg-card p-4" key={section.id}>
      <h3 className="font-bold">{section.title} · {section.section_label || '—'} · {section.academic_term || '—'}</h3>
      <p>{ar ? 'معرّف الشعبة:' : 'Section ID:'} <span dir="ltr">{section.id}</span></p>
      <p>{ar ? 'الدكتور المكلّف (معرّف):' : 'Assigned instructor (ID):'} <span dir="ltr">{section.instructor_id || '—'}</span></p>
      <div className="mt-3 flex flex-wrap gap-3">
        {section.instructor_id === userId && <Link className="text-primary underline" href={`/course/${section.id}`}>{ar ? 'السيلابس والمواد والامتحانات' : 'Syllabus, materials and exams'}</Link>}
        <Button variant="outline" onClick={() => setRoster(roster === section.id ? null : section.id)}>{ar ? 'عرض الطلاب' : 'View students'} ({counts.data?.find(c => c.course_id === section.id)?.enrollment_count ?? '—'})</Button>
        {admin && <Button variant="outline" onClick={() => setAssign(assign === section.id ? null : section.id)}>{ar ? 'تغيير الإسناد' : 'Change assignment'}</Button>}
      </div>
      <div className="mt-3"><SectionActivityLinks sectionId={section.id} ar={ar}/></div>
      {roster === section.id && <Roster key={`${section.id}:${revision}`} id={section.id} ar={ar} />}
      {assign === section.id && <Assignment key={`${section.id}:${revision}`} section={section} ar={ar} onSaved={onSaved} />}
    </article>)}
  </div>;
}
