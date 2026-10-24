import { Button } from "@workspace/y-hub-ds/components/ui/button";
export interface KnowledgeSource {
  id: string;
  title: string;
  kind: "pdf" | "syllabus";
  status: "pending" | "ready" | "unreadable";
  material_id: string | null;
}
export function KnowledgeSources({
  sources,
  selected,
  onSelect,
  manage,
  busy,
  onIndex,
}: {
  sources: KnowledgeSource[];
  selected: string;
  onSelect: (id: string) => void;
  manage: boolean;
  busy: boolean;
  onIndex: (id: string) => void;
}) {
  return (
    <section
      className="mb-3 rounded-lg border p-3 text-sm space-y-2"
      aria-label="Knowledge sources / مصادر المعرفة"
    >
      <label className="flex flex-wrap items-center gap-2">
        Source / المصدر
        <select
          aria-label="Source / المصدر"
          className="rounded border bg-background p-2 max-w-full"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          disabled={busy}
        >
          <option value="">All indexed sources / كل المصادر المفهرسة</option>
          {sources.map((s) => (
            <option value={s.id} key={s.id}>
              {s.title} — {s.status === "ready"
                ? "Ready / جاهز"
                : s.status === "unreadable"
                ? "No text / بلا نص"
                : "Needs indexing / يحتاج فهرسة"}
            </option>
          ))}
        </select>
      </label>
      {manage &&
        sources.map((s) => (
          <div className="flex justify-between gap-2" key={s.id}>
            <span>{s.title}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                onIndex(s.id)}
            >
              {s.status === "ready" ? "Reindex / إعادة فهرسة" : "Index / فهرسة"}
            </Button>
          </div>
        ))}
      {!sources.some((s) => s.status === "ready") && (
        <p>
          No ready sources. Ask your instructor to index the materials. / اطلب
          من الدكتور فهرسة المواد.
        </p>
      )}
      <p className="text-muted-foreground">
        Session-only conversation; cleared on access loss or leaving this page.
        / المحادثة لهذه الجلسة فقط وتُمسح عند فقدان الصلاحية أو مغادرة الصفحة.
      </p>
    </section>
  );
}
