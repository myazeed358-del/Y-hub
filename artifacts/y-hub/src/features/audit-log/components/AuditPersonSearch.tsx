import { useEffect, useState } from 'react';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { profileName } from '@/shared/identity/profileName';
import { suggestAuditPeople } from '../services/auditLogRepository';
import type { AuditFilters, AuditPerson, PersonScope } from '../domain/auditLog';
import type { AuditCopy } from '../domain/copy';
import { AuditPersonIdentity } from './AuditPersonIdentity';
export function AuditPersonSearch({ filters, onChange, copy }: { filters: AuditFilters; onChange: (value: AuditFilters) => void; copy: AuditCopy }) {
  const { language } = useLanguage();
  const [people, setPeople] = useState<AuditPerson[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setPeople([]); setError(false);
    if (filters.actor || filters.personSearch.trim().length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      suggestAuditPeople(filters.personSearch, filters.personScope, controller.signal).then(rows => {
        if (!controller.signal.aborted) setPeople(rows);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters.personSearch, filters.personScope, filters.actor]);
  return <div className="space-y-3 sm:col-span-2 lg:col-span-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">{copy.person}
        <Input maxLength={120} value={filters.personSearch} onChange={e => onChange({ ...filters, personSearch: e.target.value, actor: '' })} />
      </label>
      <label className="space-y-1 text-sm">{copy.personScope}
        <select className="h-10 w-full rounded-md border bg-background px-3" value={filters.personScope} onChange={e => onChange({ ...filters, actor: '', personScope: e.target.value as PersonScope })}>
          <option value="either">{copy.eitherScope}</option><option value="actor">{copy.actorScope}</option><option value="affected">{copy.affectedScope}</option>
        </select>
      </label>
    </div>
    {error && <p role="status" className="text-sm text-muted-foreground">{copy.suggestionError}</p>}
    {people.length > 0 && <ul aria-label={copy.suggestions} className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
      {people.map(person => <li key={person.person_id}><Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal text-start" onClick={() => {
        // Selecting an ID must not retain a mismatching name filter after language changes.
        onChange({ ...filters, actor: person.person_id, personSearch: person.user_number || profileName(person, language) });
        setPeople([]);
      }}><AuditPersonIdentity person={person} copy={copy} /></Button></li>)}
    </ul>}
  </div>;
}
