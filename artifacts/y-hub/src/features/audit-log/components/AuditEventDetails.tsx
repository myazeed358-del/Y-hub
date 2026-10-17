import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/y-hub-ds/components/ui/dialog';
import type { AuditEvent } from '../domain/auditLog';
import type { AuditCopy } from '../domain/copy';

export function AuditEventDetails({ event, copy, onClose }: { event: AuditEvent | null; copy: AuditCopy; onClose: () => void }) {
  const value = (data: unknown) => data === undefined ? copy.absent : data === '[REDACTED]' ? copy.redacted : typeof data === 'string' ? data : JSON.stringify(data);
  return <Dialog open={Boolean(event)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{copy.details}</DialogTitle><DialogDescription>{copy.detailDescription}</DialogDescription></DialogHeader>
      {event && <div className="space-y-4 text-start">
        <p className="break-all text-sm">{copy.event}: {event.id}</p>
        <p>{event.actor_name || copy.values[event.actor_role]} · {copy.values[event.actor_role]}</p>
        <p>{copy.values[event.entity_type] ?? event.entity_type} <span className="break-all font-mono text-xs">{event.entity_id}</span></p>
        {event.super_admin_only && <p className="text-sm font-semibold">{copy.restricted}</p>}
        <h3 className="font-semibold">{copy.changes}</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr>{[copy.field, copy.before, copy.after].map(label => <th key={label} className="border-b p-2 text-start">{label}</th>)}</tr></thead>
          <tbody>{[...new Set([...Object.keys(event.old_values), ...Object.keys(event.new_values)])].map(field => <tr key={field}>
            <td className="border-b p-2 font-mono">{field}</td>
            <td className="max-w-64 break-words border-b p-2">{value(event.old_values[field])}</td>
            <td className="max-w-64 break-words border-b p-2">{value(event.new_values[field])}</td>
          </tr>)}</tbody>
        </table></div>
        <h3 className="font-semibold">{copy.context}</h3>
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs" dir="ltr">{JSON.stringify(event.context, null, 2)}</pre>
      </div>}
    </DialogContent>
  </Dialog>;
}
