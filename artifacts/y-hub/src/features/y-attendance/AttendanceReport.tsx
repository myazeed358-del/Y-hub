import { useEffect, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import {
  attendanceCsv,
  type AttendanceReport as Report,
  attendanceRepository as repo,
} from "./repository";
export function AttendanceReport(
  { course, version, ar }: { course: string; version: number; ar: boolean },
) {
  const [offset, setOffset] = useState(0),
    [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(false),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    setOffset(0);
  }, [course]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    setError(false);
    async function refresh() {
      try {
        const d = await repo.report(course, offset);
        if (active) {
          setData(d);
          setError(false);
        }
      } catch {
        if (active) {
          setData(null);
          setError(true);
        }
      }
      if (active) timer = setTimeout(() => void refresh(), 15000);
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [course, offset, version]);
  async function download() {
    setExporting(true);
    setError(false);
    try {
      let rows: Report["rows"] = [];
      let page: Report;
      let start = 0;
      do {
        page = await repo.report(course, start);
        rows.push(...page.rows);
        start += page.rows.length;
      } while (page.rows.length && start < page.total);
      const url = URL.createObjectURL(
        new Blob([attendanceCsv(rows)], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "attendance.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        {ar ? "سجل الحضور" : "Attendance report"}
      </h2>
      {error && (
        <p role="alert">
          {ar
            ? "تعذر تحميل التقرير أو تصديره."
            : "Report load or export failed."}
        </p>
      )}
      {!data && !error && (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      )}
      {data && (
        <>
          <p>
            {ar ? "الجلسات المغلقة: الغياب" : "Closed sessions: absent"}{" "}
            {data.stats.absent}/{data.stats.eligible} ({data.stats.eligible
              ? Math.round(data.stats.absent / data.stats.eligible * 100)
              : 0}%)
          </p>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "تُحتسب النسبة من سجل الطلاب عند فتح الجلسة؛ الجلسات الملغاة مستبعدة."
              : "Rate uses the session roster; cancelled sessions/lectures are excluded."}
          </p>
          {data.rows.length === 0
            ? <p>{ar ? "لا توجد سجلات." : "No records."}</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {(ar
                        ? ["الطالب", "المحاضرة", "التاريخ", "الحالة"]
                        : ["Student", "Lecture", "Date", "Status"]).map((x) => (
                          <th key={x} className="p-2 text-start">{x}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-2">
                          {r.full_name ?? "—"}
                          <span dir="ltr" className="block font-mono">
                            {r.user_number}
                          </span>
                        </td>
                        <td className="p-2">{r.title}</td>
                        <td className="p-2">
                          {new Date(r.starts_at).toLocaleString(
                            ar ? "ar" : "en",
                          )}
                        </td>
                        <td className="p-2">
                          {ar
                            ? ({
                              present: "حاضر",
                              absent: "غائب",
                              excused: "بعذر",
                            }[r.status])
                            : r.status}
                          {r.state === "cancelled" &&
                            (ar ? " (ملغاة)" : " (cancelled)")}
                          {r.state === "open" &&
                            (ar ? " (مؤقت)" : " (provisional)")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((x) => Math.max(0, x - 100))}
            >
              {ar ? "السابق" : "Previous"}
            </Button>
            <Button
              variant="outline"
              disabled={offset + 100 >= data.total}
              onClick={() => setOffset((x) => x + 100)}
            >
              {ar ? "التالي" : "Next"}
            </Button>
            <Button
              variant="outline"
              disabled={exporting}
              onClick={() => void download()}
            >
              {ar ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
