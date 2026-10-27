import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/y-hub-ds/components/ui/tabs";
import { type GrantEntry, grantWorkflows } from "../workflowRepository";
import { engineAccessRepository } from "../repository";
export function GrantHistory(
  { course, student, version, ar, title, onSaved }: {
    course: string;
    student: string;
    version: number;
    ar: boolean;
    title: (id: string) => string;
    onSaved: () => void;
  },
) {
  const [active, setActive] = useState(true),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<{ rows: GrantEntry[]; total: number } | null>(
      null,
    ),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    setOffset(0);
  }, [course, student, active]);
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    setError(false);
    async function refresh() {
      try {
        const result = await grantWorkflows.history(
          course,
          student,
          active,
          offset,
        );
        if (mounted) {
          setData(result);
          setError(false);
        }
      } catch {
        if (mounted) {
          setData(null);
          setError(true);
        }
      }
      if (mounted) timer = setTimeout(() => void refresh(), 15000);
    }
    void refresh();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [course, student, active, offset, version]);
  const labels: Record<GrantEntry["state"], string> = {
    active: ar ? "فعالة" : "Active",
    manual: ar ? "أُلغيت يدويًا" : "Manually revoked",
    withdrawal: ar ? "أُلغيت بسبب الانسحاب" : "Revoked on withdrawal",
    assignment: ar ? "أُلغيت بسبب تغيير الدكتور" : "Revoked on reassignment",
    identity: ar
      ? "أُلغيت بسبب تغير الدور أو التخصص"
      : "Revoked on role/major change",
    expired: ar ? "منتهية" : "Expired",
    revoked: ar
      ? "ملغاة — سبب تاريخي غير مسجل"
      : "Revoked — historical reason unavailable",
    unavailable: ar
      ? "غير متاحة وفق الصلاحيات الحالية"
      : "Unavailable under current permissions",
  };
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {ar ? "تصاريح المحركات" : "Engine permissions"}
      </h2>
      <Tabs
        dir={ar ? "rtl" : "ltr"}
        value={active ? "active" : "previous"}
        onValueChange={(v) => setActive(v === "active")}
      >
        <TabsList>
          <TabsTrigger value="active">{ar ? "نشط" : "Active"}</TabsTrigger>
          <TabsTrigger value="previous">{ar ? "سابق" : "Previous"}</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && (
        <p role="alert">
          {ar ? "تعذر التحقق من التصاريح." : "Unable to verify permissions."}
        </p>
      )}
      {!data && !error && (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      )}
      {data && (
        <>
          <p>{ar ? "عدد النتائج:" : "Results:"} {data.total}</p>
          {!data.rows.length && (
            <p>{ar ? "لا توجد تصاريح مطابقة." : "No matching permissions."}</p>
          )}
          {data.rows.map((g) => (
            <article
              key={g.id}
              className="space-y-2 rounded-xl border border-border bg-card p-4"
            >
              <h3 className="font-semibold">{title(g.engine_id)}</h3>
              <p>
                {g.full_name ?? "—"} · <span dir="ltr">{g.user_number}</span>
              </p>
              <p>{g.title} · {g.section_label}</p>
              <p>{labels[g.state]}</p>
              <p>
                {g.expires_at
                  ? (
                    <time dateTime={g.expires_at}>
                      {new Date(g.expires_at).toLocaleString(ar ? "ar" : "en")}
                    </time>
                  )
                  : (ar ? "طوال التسجيل الفعال" : "For active enrollment")}
              </p>
              {!g.revoked_at && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={async () => {
                    if (
                      pending.current ||
                      !window.confirm(
                        ar ? "إلغاء هذه المنحة؟" : "Revoke this grant?",
                      )
                    ) return;
                    pending.current = true;
                    setBusy(true);
                    try {
                      await engineAccessRepository.revoke(g.id);
                      onSaved();
                    } catch {
                      setError(true);
                    } finally {
                      pending.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  {ar ? "إلغاء المنحة" : "Revoke grant"}
                </Button>
              )}
            </article>
          ))}
          <nav
            className="flex gap-2"
            aria-label={ar ? "صفحات التصاريح" : "Permission pages"}
          >
            <Button
              variant="outline"
              disabled={busy || !offset}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              {ar ? "الصفحة السابقة" : "Previous page"}
            </Button>
            <Button
              variant="outline"
              disabled={busy || offset + 100 >= data.total}
              onClick={() => setOffset(offset + 100)}
            >
              {ar ? "الصفحة التالية" : "Next page"}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
