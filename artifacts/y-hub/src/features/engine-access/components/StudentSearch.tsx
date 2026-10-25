import { useEffect, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { grantWorkflows, type StudentMatch } from "../workflowRepository";
export function StudentSearch(
  { course, search, version, ar, onSelect }: {
    course: string;
    search: string;
    version: number;
    ar: boolean;
    onSelect: (student: StudentMatch) => void;
  },
) {
  const [offset, setOffset] = useState(0),
    [data, setData] = useState<{ rows: StudentMatch[]; total: number } | null>(
      null,
    ),
    [error, setError] = useState(false);
  useEffect(() => {
    setOffset(0);
  }, [course, search]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    grantWorkflows.search(course, search, offset).then((r) => {
      if (active) setData(r);
    }, () => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [course, search, offset, version]);
  return (
    <section className="space-y-3">
      {error && (
        <p role="alert">
          {ar
            ? "تعذر البحث في الطلاب المصرح بهم."
            : "Unable to search authorized students."}
        </p>
      )}
      {!data && !error && (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      )}
      {data && (
        <>
          <p>
            {ar ? "عدد العلاقات المطابقة:" : "Matching section memberships:"}
            {" "}
            {data.total}
          </p>
          {!data.rows.length && (
            <p>{ar ? "لا يوجد طلاب مطابقون." : "No matching students."}</p>
          )}
          <ul className="space-y-2">
            {data.rows.map((r) => (
              <li key={`${r.course_id}:${r.student_id}`}>
                <button
                  className="w-full rounded-lg border border-border bg-card p-3 text-start hover:border-primary"
                  onClick={() => onSelect(r)}
                >
                  <strong>{r.full_name ?? "—"}</strong>
                  <span className="block font-mono" dir="ltr">
                    {r.user_number}
                  </span>
                  <span className="block">{r.title} · {r.section_label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {r.active_enrollment
                      ? (ar ? "مسجل فعال" : "Active enrollment")
                      : (ar ? "علاقة سابقة" : "Historical relationship")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <nav
            className="flex gap-2"
            aria-label={ar ? "صفحات الطلاب" : "Student pages"}
          >
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              {ar ? "الطلاب السابقون" : "Previous students"}
            </Button>
            <Button
              variant="outline"
              disabled={offset + 50 >= data.total}
              onClick={() => setOffset(offset + 50)}
            >
              {ar ? "الطلاب التاليون" : "Next students"}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
