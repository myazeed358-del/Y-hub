import { attendanceCsv, type AttendanceReport } from "../repository";
type Rows = AttendanceReport["rows"];
export function reportCells(rows: Rows, ar: boolean): string[][] {
  const status = {
    present: ar ? "حاضر" : "Present",
    absent: ar ? "غائب" : "Absent",
    excused: ar ? "بعذر (تاريخي)" : "Excused (historical)",
  };
  const state: Record<string, string> = {
    open: ar ? "مؤقت" : "Provisional",
    closed: ar ? "مغلق" : "Closed",
    cancelled: ar ? "ملغى" : "Cancelled",
  };
  return [
    ar
      ? [
        "الطالب",
        "رقم Y-Hub",
        "المحاضرة",
        "تاريخ الجلسة",
        "الحالة",
        "حالة الجلسة",
      ]
      : [
        "Student",
        "Y-Hub number",
        "Lecture",
        "Session date",
        "Status",
        "Session state",
      ],
    ...rows.map(
      (r) => [
        r.full_name ?? "",
        r.user_number,
        r.title,
        new Date(r.starts_at).toLocaleString(ar ? "ar" : "en"),
        status[r.status],
        state[r.state] ?? r.state,
      ],
    ),
  ];
}
export async function attendanceWorkbook(rows: Rows, ar: boolean) {
  const XLSX = await import("@e965/xlsx");
  // Strings are stored as text cells, never formulas, including student numbers.
  const sheet = XLSX.utils.aoa_to_sheet(reportCells(rows, ar));
  sheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 26 }, {
    wch: 20,
  }, { wch: 18 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Attendance");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
export function downloadWorkbook(bytes: ArrayBuffer) {
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Native print preserves Arabic shaping and paginates searchable text. Choose Save as PDF. */
export async function printAttendance(
  rows: Rows,
  ar: boolean,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const frame = document.createElement("iframe");
  frame.title = ar ? "تصدير تقرير الحضور" : "Attendance PDF export";
  frame.style.cssText =
    "position:fixed;width:900px;height:1px;left:-10000px;border:0";
  document.body.append(frame);
  const cleanup = () => frame.remove();
  signal.addEventListener("abort", cleanup, { once: true });
  try {
    const doc = frame.contentDocument!;
    doc.documentElement.lang = ar ? "ar" : "en";
    doc.documentElement.dir = ar ? "rtl" : "ltr";
    doc.title = ar ? "سجل الحضور" : "Attendance report";
    const style = doc.createElement("style");
    style.textContent =
      "@page{size:A4 landscape;margin:12mm}body{font:12px Arial,sans-serif;color:#111;background:white}table{width:100%;border-collapse:collapse}th,td{padding:6px;border:1px solid #aaa;text-align:start;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:20px}";
    doc.head.append(style);
    const title = doc.createElement("h1");
    title.textContent = doc.title;
    doc.body.append(title);
    const table = doc.createElement("table"),
      head = doc.createElement("thead"),
      body = doc.createElement("tbody");
    table.append(head, body);
    reportCells(rows, ar).forEach((values, index) => {
      const tr = doc.createElement("tr");
      values.forEach((value) => {
        const cell = doc.createElement(index ? "td" : "th");
        cell.textContent = value;
        tr.append(cell);
      });
      (index ? body : head).append(tr);
    });
    doc.body.append(table);
    await doc.fonts.ready;
    signal.throwIfAborted();
    frame.contentWindow!.addEventListener("afterprint", () => {
      signal.removeEventListener("abort", cleanup);
      cleanup();
    }, { once: true });
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
  } catch (error) {
    signal.removeEventListener("abort", cleanup);
    cleanup();
    throw error;
  }
}

export function downloadAttendanceCsv(rows: Rows) {
  const url = URL.createObjectURL(
    new Blob([attendanceCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
