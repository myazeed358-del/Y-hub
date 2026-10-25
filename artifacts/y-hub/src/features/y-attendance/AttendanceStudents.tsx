import { useEffect, useState } from "react";
import { attendanceRepository as repo } from "./repository";
export function AttendanceStudents(
  { course, ar, version }: { course: string; ar: boolean; version: number },
) {
  const [rows, setRows] = useState<
      Awaited<ReturnType<typeof repo.roster>> | null
    >(null),
    [error, setError] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    setRows(null);
    setError(false);
    repo.roster(course).then((r) => {
      if (active) setRows(r);
    }, () => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [course, version]);
  if (error) {
    return (
      <p role="alert">
        {ar
          ? "تعذر التحقق من الطلاب والصلاحيات."
          : "Unable to verify roster and permissions."}
      </p>
    );
  }
  if (!rows) return <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>;
  const filtered = rows.filter((r) =>
    `${r.full_name ?? ""} ${r.user_number}`.toLocaleLowerCase().includes(
      search.trim().toLocaleLowerCase(),
    )
  );
  return (
    <div className="space-y-3">
      <h2>
        {ar ? "المسجلون حاليًا بالشعبة" : "Current section enrollments"}{" "}
        ({rows.length})
      </h2>
      <label>
        {ar ? "بحث الطلاب" : "Search students"}
        <input
          className="w-full rounded border border-border bg-background p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-start">
          <thead>
            <tr>
              <th>{ar ? "الاسم" : "Name"}</th>
              <th>{ar ? "الرقم الجامعي" : "Student number"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.student_id}>
                <td>{r.full_name ?? "—"}</td>
                <td dir="ltr">{r.user_number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p>{ar ? "لا توجد نتائج." : "No results."}</p>}
    </div>
  );
}
