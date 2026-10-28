import { useLanguage } from '@/i18n/LanguageContext';
import { profileName } from '@/shared/identity/profileName';
import type { AuditPerson } from '../domain/auditLog';
import type { AuditCopy } from '../domain/copy';
export function AuditPersonIdentity({ person, fallback, copy }: { person?: AuditPerson; fallback?: string; copy: AuditCopy }) {
  const { language } = useLanguage();
  return <div className="min-w-0 break-words">
    <p>{profileName(person, language, fallback || copy.unknown)}</p>
    <span className="block font-mono text-xs" dir="ltr">{person?.user_number || copy.unknown}</span>
    {person && !person.recorded && <span className="block max-w-60 text-xs text-muted-foreground">{copy.legacy}</span>}
  </div>;
}
