import { useState } from 'react';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { academicRepository } from '../services/repository';
import { useAcademicResource } from '../hooks/useAcademicResource';
export function InstructorPicker({ value, onChange, ar, disabled }: { value: string; onChange: (id: string) => void; ar: boolean; disabled: boolean }) {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0);
  const state = useAcademicResource(`${search}:${page}`, () => academicRepository.instructors(search, page));
  return <fieldset disabled={disabled} className="space-y-2">
    <legend>{ar ? 'الدكتور المكلّف' : 'Assigned instructor'}</legend>
    <Input aria-label={ar ? 'بحث عن دكتور' : 'Search instructors'} placeholder={ar ? 'بحث عن دكتور' : 'Search instructors'} value={search} onChange={e => { setSearch(e.target.value); setPage(0); onChange(''); }} />
    {state.error && <p role="alert">{ar ? 'تعذر تحميل الدكاترة' : 'Unable to load instructors'}</p>}
    <select aria-label={ar ? 'الدكتور المكلّف' : 'Assigned instructor'} required value={value} onChange={e => onChange(e.target.value)} className="w-full border bg-background p-2">
      <option value="">{state.loading ? '…' : ar ? 'اختر الدكتور' : 'Choose instructor'}</option>
      {state.data?.map(item => <option key={item.id} value={item.id}>{item.full_name || item.id}</option>)}
    </select>
    <Button type="button" disabled={!page} onClick={() => { setPage(page - 1); onChange(''); }}>←</Button>
    <Button type="button" disabled={state.data?.length !== 50} onClick={() => { setPage(page + 1); onChange(''); }}>→</Button>
  </fieldset>;
}
