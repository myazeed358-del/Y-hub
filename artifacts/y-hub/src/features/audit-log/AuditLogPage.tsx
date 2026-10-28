import { AuditPersonIdentity } from './components/AuditPersonIdentity';
import { AuditPersonSearch } from './components/AuditPersonSearch';
import { useState, type FormEvent } from 'react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, emptyFilters, filterParameters, type AuditEvent, type AuditFilters } from './domain/auditLog';
import { auditCopy } from './domain/copy';
import { useAuditLog } from './hooks/useAuditLog';
import { AuditEventDetails } from './components/AuditEventDetails';

export default function AuditLogPage() {
  const { user, role } = useAuth();
  // Drop cached rows, suggestions and open details when the viewing identity changes.
  if (!user || (role !== 'admin' && role !== 'super_admin')) return null;
  return <AuditReview key={`${user.id}:${role}`} />;
}

function AuditReview() {
  const { language } = useLanguage();
  const copy = auditCopy[language];
  const log = useAuditLog();
  const [draft, setDraft] = useState<AuditFilters>(emptyFilters);
  const [invalid, setInvalid] = useState(false);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const field = (key: keyof AuditFilters, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try { filterParameters(draft); setInvalid(false); setSelected(null); log.applyFilters(draft); }
    catch { setInvalid(true); }
  };
  return <section className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p></div>
      <Button variant="outline" onClick={log.refresh} disabled={log.loading}>{copy.refresh}</Button>
    </header>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-sm">{copy.search}<Input value={draft.search} maxLength={200} onChange={e => field('search', e.target.value)} /></label>
      <AuditPersonSearch filters={draft} onChange={setDraft} copy={copy} />
      <label className="space-y-1 text-sm">{copy.action}<select className="h-10 w-full rounded-md border bg-background px-3" value={draft.action} onChange={e => field('action', e.target.value)}>
        <option value="">{copy.all}</option>{AUDIT_ACTIONS.map(action => <option key={action} value={action}>{copy.values[action]}</option>)}
      </select></label>
      <label className="space-y-1 text-sm">{copy.entity}<select className="h-10 w-full rounded-md border bg-background px-3" value={draft.entity} onChange={e => field('entity', e.target.value)}>
        <option value="">{copy.all}</option>{AUDIT_ENTITIES.map(entity => <option key={entity} value={entity}>{copy.values[entity]}</option>)}
      </select></label>
      <label className="space-y-1 text-sm">{copy.from}<Input type="date" value={draft.from} onChange={e => field('from', e.target.value)} /></label>
      <label className="space-y-1 text-sm">{copy.to}<Input type="date" value={draft.to} onChange={e => field('to', e.target.value)} /></label>
      <Button type="submit" disabled={log.loading}>{copy.apply}</Button>
      {invalid && <p role="alert" className="text-sm text-destructive">{copy.invalid}</p>}
    </form>
    {!log.loading && !log.error && <p role="status">{copy.results}: {log.total}</p>}
    <div aria-live="polite" aria-busy={log.loading}>
      {log.loading ? <p role="status" className="p-8 text-center">{copy.loading}</p>
        : log.error ? <p role="alert" className="p-8 text-center text-destructive">{copy.error}</p>
        : !log.events.length ? <p className="p-8 text-center text-muted-foreground">{copy.empty}</p>
        : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted"><tr>{[copy.who, copy.affected, copy.action, copy.entity, copy.time, copy.sensitivity, copy.details].map(label => <th key={label} className="p-3 text-start font-semibold">{label}</th>)}</tr></thead>
          <tbody>{log.events.map(event => <tr key={event.id} className="border-t">
            <td className="p-3"><AuditPersonIdentity person={event.people.find(person => person.relation === 'actor')} fallback={event.actor_name || copy.values[event.actor_role]} copy={copy} /><span className="text-xs text-muted-foreground">{copy.values[event.actor_role]}</span></td>
            <td className="p-3">{event.people.filter(person => person.relation === 'affected').map(person => <AuditPersonIdentity key={person.person_id} person={person} copy={copy} />)}{!event.people.some(person => person.relation === 'affected') && copy.unknown}</td>
            <td className="p-3">{event.actions.map(action => copy.values[action] ?? action).join(' · ')}</td>
            <td className="p-3">{copy.values[event.entity_type] ?? event.entity_type}<span className="block max-w-48 truncate font-mono text-xs" title={event.entity_id}>{event.entity_id}</span></td>
            <td className="whitespace-nowrap p-3"><time dateTime={event.occurred_at}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(event.occurred_at))}</time></td>
            <td className="p-3"><span className="rounded-full border px-2 py-1 text-xs font-semibold">{copy.values[event.sensitivity]}</span></td>
            <td className="p-3"><Button variant="outline" size="sm" onClick={() => setSelected(event)}>{copy.details}</Button></td>
          </tr>)}</tbody>
        </table></div>}
    </div>
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" disabled={log.loading || log.pageNumber === 1} onClick={log.previous}>{copy.previous}</Button>
      <span className="text-sm">{copy.page} {log.pageNumber}</span>
      <Button variant="outline" disabled={log.loading || !log.next || log.error} onClick={log.nextPage}>{copy.next}</Button>
    </div>
    <AuditEventDetails event={selected} copy={copy} onClose={() => setSelected(null)} />
  </section>;
}
