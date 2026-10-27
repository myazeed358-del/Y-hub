import type { FilteredReport } from "./repository";
export function ReportSummary(
  { data, ar, chart }: { data: FilteredReport; ar: boolean; chart: boolean },
) {
  const rate = data.stats.eligible
    ? Math.round(data.stats.absent / data.stats.eligible * 100)
    : 0;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [ar ? "سجلات مؤهلة" : "Eligible records", data.stats.eligible],
          [ar ? "حاضر" : "Present", data.stats.present],
          [ar ? "غائب" : "Absent", data.stats.absent],
          [ar ? "نسبة الغياب" : "Absence rate", `${rate}%`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "الإحصاءات للفلاتر الحالية والجلسات المغلقة فقط؛ الجلسات الملغاة والمفتوحة مستبعدة."
          : "Statistics cover current filters and closed sessions only; cancelled and open sessions are excluded."}
      </p>
      {data.stats.excused > 0 && (
        <p>
          {ar
            ? "سجلات بعذر تاريخية محفوظة دون إعادة تصنيف:"
            : "Historical excused records preserved without reclassification:"}
          {" "}
          {data.stats.excused}
        </p>
      )}
      {chart && (
        <figure className="space-y-2">
          <figcaption>
            {ar
              ? "نسبة الغياب — آخر 30 يومًا بها سجلات (UTC)"
              : "Absence rate — latest 30 activity dates (UTC)"}
          </figcaption>
          {!data.trend.length && (
            <p>
              {ar
                ? "لا توجد جلسات مغلقة مطابقة."
                : "No matching closed sessions."}
            </p>
          )}
          {data.trend.map((day) => {
            const percentage = day.eligible
              ? Math.round(day.absent / day.eligible * 100)
              : 0;
            return (
              <div
                key={day.day}
                className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-sm"
              >
                <time dir="ltr">{day.day}</time>
                <meter
                  className="w-full accent-cyan-400"
                  min={0}
                  max={100}
                  value={percentage}
                  aria-label={`${day.day}: ${day.absent}/${day.eligible}`}
                >
                  {percentage}%
                </meter>
                <span dir="ltr">{percentage}%</span>
              </div>
            );
          })}
        </figure>
      )}
    </div>
  );
}
