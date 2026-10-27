import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import type { AcademicLecture } from "@/shared/academic/lectures";
import {
  collectReport,
  emptyFilters,
  type FilteredReport,
  loadReport,
} from "./reports/repository";
import { ReportFilters } from "./reports/ReportFilters";
import { ReportSummary } from "./reports/ReportSummary";
import { ReportTable } from "./reports/ReportTable";
import {
  attendanceWorkbook,
  downloadAttendanceCsv,
  downloadWorkbook,
  printAttendance,
} from "./reports/export";
export function AttendanceReport(
  { course, version, ar, lectures = [], mode = "reports" }: {
    course: string;
    version: number;
    ar: boolean;
    lectures?: AcademicLecture[];
    mode?: "history" | "analytics" | "reports";
  },
) {
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters),
    [offset, setOffset] = useState(0);
  const [data, setData] = useState<FilteredReport | null>(null),
    [error, setError] = useState(false),
    [exporting, setExporting] = useState(false);
  const exportingRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    setOffset(0);
  }, [course]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setData(null);
    setError(false);
    setExporting(false);
    async function refresh() {
      try {
        const result = await loadReport(course, filters, offset);
        if (active) {
          setData(result);
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
      exportingRef.current?.abort();
      exportingRef.current = null;
    };
  }, [course, filters, offset, version]);
  async function download(format: "xlsx" | "pdf" | "csv") {
    if (exportingRef.current) return;
    const controller = new AbortController();
    exportingRef.current = controller;
    setExporting(true);
    setError(false);
    try {
      const rows = await collectReport(course, filters, controller.signal);
      if (format === "xlsx") {
        const bytes = await attendanceWorkbook(rows, ar);
        controller.signal.throwIfAborted();
        downloadWorkbook(bytes);
      } else if (format === "csv") {
        controller.signal.throwIfAborted();
        downloadAttendanceCsv(rows);
      } else await printAttendance(rows, ar, controller.signal);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (exportingRef.current === controller) {
        exportingRef.current = null;
        setExporting(false);
      }
    }
  }
  return (
    <div className="space-y-4">
      <ReportFilters
        value={draft}
        onChange={setDraft}
        onApply={() => {
          setFilters({ ...draft });
          setOffset(0);
          setExporting(false);
        }}
        lectures={lectures}
        ar={ar}
      />
      {error && (
        <p role="alert">
          {ar
            ? "تعذر تحميل التقرير أو تغير أثناء التصدير. تحقق من الصلاحيات والفلاتر ثم أعد المحاولة."
            : "Report failed or changed during export. Check access and filters, then retry."}
        </p>
      )}
      {!data && !error && (
        <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
      )}
      {data && (
        <>
          <ReportSummary data={data} ar={ar} chart={mode === "analytics"} />
          {mode !== "analytics" && (
            <>
              <p>{ar ? "عدد النتائج:" : "Results:"} {data.total}</p>
              <ReportTable rows={data.rows} ar={ar} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!offset || exporting}
                  onClick={() => setOffset(Math.max(0, offset - 100))}
                >
                  {ar ? "السابق" : "Previous"}
                </Button>
                <Button
                  variant="outline"
                  disabled={offset + 100 >= data.total || exporting}
                  onClick={() => setOffset(offset + 100)}
                >
                  {ar ? "التالي" : "Next"}
                </Button>
              </div>
            </>
          )}
          {mode === "reports" && (
            <>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "التصدير للفلاتر الحالية (حتى 10,000 سجل). لحفظ PDF اختر «حفظ كـ PDF» في نافذة الطباعة."
                  : "Export uses current filters (up to 10,000 records). To save PDF, choose “Save as PDF” in the print dialog."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={exporting || !data.total || data.total > 10000}
                  onClick={() => void download("csv")}
                >
                  {ar ? "تصدير CSV" : "Export CSV"}
                </Button>
                <Button
                  variant="outline"
                  disabled={exporting || !data.total || data.total > 10000}
                  onClick={() => void download("xlsx")}
                >
                  {ar ? "تصدير Excel" : "Export Excel"}
                </Button>
                <Button
                  variant="outline"
                  disabled={exporting || !data.total || data.total > 10000}
                  onClick={() => void download("pdf")}
                >
                  {ar ? "PDF / طباعة" : "PDF / Print"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
