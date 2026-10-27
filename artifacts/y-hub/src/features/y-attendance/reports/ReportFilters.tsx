import { Button } from "@workspace/y-hub-ds/components/ui/button";
import type { AcademicLecture } from "@/shared/academic/lectures";
import type { ReportFilters as Filters } from "./repository";
export function ReportFilters(
  { value, onChange, onApply, lectures, ar }: {
    value: Filters;
    onChange: (f: Filters) => void;
    onApply: () => void;
    lectures: AcademicLecture[];
    ar: boolean;
  },
) {
  const field = "w-full rounded-md border border-border bg-background p-2";
  const update = (key: keyof Filters, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <label>
        {ar ? "الاسم أو الرقم الجامعي" : "Name or student number"}
        <input
          className={field}
          maxLength={100}
          value={value.search}
          onChange={(e) => update("search", e.target.value)}
        />
      </label>
      <label>
        {ar ? "من تاريخ" : "From date"}
        <input
          className={field}
          type="date"
          value={value.from}
          onChange={(e) => update("from", e.target.value)}
        />
      </label>
      <label>
        {ar ? "إلى تاريخ" : "To date"}
        <input
          className={field}
          type="date"
          min={value.from || undefined}
          value={value.to}
          onChange={(e) => update("to", e.target.value)}
        />
      </label>
      <label>
        {ar ? "تصفية المحاضرة" : "Filter lecture"}
        <select
          className={field}
          value={value.lecture}
          onChange={(e) => update("lecture", e.target.value)}
        >
          <option value="">{ar ? "كل المحاضرات" : "All lectures"}</option>
          {lectures.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </label>
      <label>
        {ar ? "تصفية الحالة" : "Filter status"}
        <select
          className={field}
          value={value.status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">{ar ? "الكل" : "All"}</option>
          <option value="present">{ar ? "حاضر" : "Present"}</option>
          <option value="absent">{ar ? "غائب" : "Absent"}</option>
          <option value="excused">
            {ar ? "بعذر (تاريخي)" : "Excused (historical)"}
          </option>
        </select>
      </label>
      <label>
        {ar ? "حالة الجلسة" : "Session state"}
        <select
          className={field}
          value={value.state}
          onChange={(e) => update("state", e.target.value)}
        >
          <option value="">{ar ? "الكل" : "All"}</option>
          <option value="open">{ar ? "مفتوحة" : "Open"}</option>
          <option value="closed">{ar ? "مغلقة" : "Closed"}</option>
          <option value="cancelled">{ar ? "ملغاة" : "Cancelled"}</option>
        </select>
      </label>
      <Button>{ar ? "تطبيق الفلاتر" : "Apply filters"}</Button>
    </form>
  );
}
