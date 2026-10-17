import { useEffect, useState } from 'react';
import { emptyFilters, type AuditCursor, type AuditFilters, type AuditPage } from '../domain/auditLog';
import { listAuditEvents } from '../services/auditLogRepository';

export function useAuditLog() {
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [cursors, setCursors] = useState<(AuditCursor | null)[]>([null]);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<AuditPage>({ events: [], next: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setPage({ events: [], next: null });
    listAuditEvents(filters, cursor, controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, cursor, revision]);
  return {
    ...page, loading, error, pageNumber: cursors.length,
    applyFilters: (next: AuditFilters) => { setCursors([null]); setFilters({ ...next }); },
    refresh: () => { setCursors([null]); setRevision(value => value + 1); },
    previous: () => { if (!loading && cursors.length > 1) setCursors(value => value.slice(0, -1)); },
    nextPage: () => { if (!loading && page.next) setCursors(value => [...value, page.next]); },
  };
}
