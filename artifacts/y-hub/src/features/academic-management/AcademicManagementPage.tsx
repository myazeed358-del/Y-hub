import { useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { CourseDefinition } from '@/shared/academic/contracts';
import { academicRepository } from './services/repository';
import { useAcademicResource } from './hooks/useAcademicResource';
import { DefinitionForm } from './components/DefinitionForm';
import { SectionForm } from './components/SectionForm';
import { SectionList } from './components/SectionList';
function Workspace({ userId, admin, ar }: { userId: string; admin: boolean; ar: boolean }) {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const [sectionSearch, setSectionSearch] = useState(''); const [sectionPage, setSectionPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<CourseDefinition | null>(null);
  const definitions = useAcademicResource(`${revision}:${search}:${page}`, () => academicRepository.definitions(search, page));
  const sections = useAcademicResource(`${revision}:${sectionSearch}:${sectionPage}`, () => academicRepository.sections(sectionSearch, sectionPage));
  const refresh = () => setRevision(value => value + 1);
  return <div dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-5 p-4">
    <h1 className="text-2xl font-bold">{ar ? 'المواد والشعب الأكاديمية' : 'Academic definitions and sections'}</h1>
    <Link href="/dashboard" className="text-primary underline">{ar ? 'لوحة المساقات والنشر والتسجيل' : 'Course dashboard, publishing and enrollment'}</Link>
    <Button variant="outline" onClick={refresh}>{ar ? 'تحديث' : 'Reload'}</Button>
    <div className="grid gap-4 lg:grid-cols-2">
      {admin && <DefinitionForm ar={ar} onSaved={refresh} />}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-bold">{ar ? 'اختر مادة لإنشاء شعبة' : 'Choose a definition to create a section'}</h2>
        <Input aria-label="Search definitions" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder={ar ? 'بحث باسم المادة' : 'Search definition title'} />
        {definitions.loading && <p role="status">…</p>}
        {definitions.error && <p role="alert">{ar ? 'تعذر تحميل الكتالوج' : 'Unable to load catalog'}</p>}
        {definitions.data?.length === 0 && <p>{ar ? 'لا توجد مواد مطابقة' : 'No matching definitions'}</p>}
        <ul>{definitions.data?.map(item => <li key={item.id}><button className="py-2 text-primary underline" onClick={() => setSelected(item)}>{item.code} — {item.title} ({item.academic_major || (ar ? 'مشترك' : 'Shared')})</button></li>)}</ul>
        <Button variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>{ar ? 'السابق' : 'Previous'}</Button>
        <Button variant="outline" disabled={definitions.data?.length !== 50} onClick={() => setPage(page + 1)}>{ar ? 'التالي' : 'Next'}</Button>
      </section>
    </div>
    {selected && <SectionForm key={selected.id} definition={selected} admin={admin} userId={userId} ar={ar} onSaved={refresh} />}
    <h2 className="text-xl font-bold">{ar ? 'الشعب المصرح لك بعرضها' : 'Your authorized sections'}</h2>
    <Input aria-label="Search sections" value={sectionSearch} onChange={e => { setSectionSearch(e.target.value); setSectionPage(0); }} placeholder={ar ? 'بحث باسم الشعبة' : 'Search section title'} />
    {sections.loading && <p role="status">…</p>}
    {sections.error && <p role="alert">{ar ? 'تعذر تحميل الشعب' : 'Unable to load sections'}</p>}
    {sections.data?.length === 0 && <p>{ar ? 'لا توجد شعب مطابقة' : 'No matching sections'}</p>}
    {sections.data && <SectionList sections={sections.data} admin={admin} userId={userId} ar={ar} revision={revision} onSaved={refresh} />}
    <Button variant="outline" disabled={!sectionPage} onClick={() => setSectionPage(sectionPage - 1)}>{ar ? 'الشعب السابقة' : 'Previous sections'}</Button>
    <Button variant="outline" disabled={sections.data?.length !== 50} onClick={() => setSectionPage(sectionPage + 1)}>{ar ? 'الشعب التالية' : 'Next sections'}</Button>
  </div>;
}
export default function AcademicManagementPage() {
  const { user, role } = useAuth(); const { language } = useLanguage();
  if (!user || !['instructor','admin','super_admin'].includes(role ?? '')) return null;
  return <Workspace key={`${user.id}:${role}`} userId={user.id} admin={role === 'admin' || role === 'super_admin'} ar={language === 'ar'} />;
}
