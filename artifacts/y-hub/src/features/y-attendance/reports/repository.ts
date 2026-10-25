import { z } from "zod";
import { academicRpc } from "@/shared/academic/lectures";
import { attendanceReportSchema } from "../repository";
export type ReportFilters = {
  search: string;
  from: string;
  to: string;
  status: string;
  state: string;
  lecture: string;
};
export const emptyFilters: ReportFilters = {
  search: "",
  from: "",
  to: "",
  status: "",
  state: "",
  lecture: "",
};
const schema = attendanceReportSchema.extend({
  revision: z.string().regex(/^[a-f0-9]{32}$/),
  trend: z.array(
    z.object({
      day: z.string(),
      eligible: z.number(),
      present: z.number(),
      absent: z.number(),
      excused: z.number(),
    }),
  ),
});
export type FilteredReport = z.infer<typeof schema>;
export function filterArguments(f: ReportFilters) {
  // Date inputs represent local calendar days; the API receives absolute half-open bounds.
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const to = f.to ? new Date(`${f.to}T00:00:00`) : null;
  if (to) to.setDate(to.getDate() + 1);
  if (
    (from && !Number.isFinite(+from)) || (to && !Number.isFinite(+to)) ||
    (from && to && from >= to)
  ) throw Error("Invalid dates");
  return {
    p_search: f.search.trim(),
    p_from: from?.toISOString() ?? null,
    p_to: to?.toISOString() ?? null,
    p_status: f.status || null,
    p_state: f.state || null,
    p_lecture: f.lecture || null,
  };
}
export function loadReport(course: string, filters: ReportFilters, offset = 0) {
  return academicRpc("attendance_report_v2", {
    p_course: course,
    p_offset: offset,
    p_limit: 100,
    ...filterArguments(filters),
  }, schema);
}
/** All-or-nothing bounded export. Never publish a partial/stale/changed-account download. */
export async function collectReport(
  course: string,
  filters: ReportFilters,
  signal: AbortSignal,
) {
  const rows: FilteredReport["rows"] = [];
  let revision: string | undefined;
  let total: number | undefined;
  do {
    signal.throwIfAborted();
    const page = await loadReport(course, filters, rows.length);
    signal.throwIfAborted();
    if (page.total > 10000) {
      throw Error("Narrow report filters: export limit 10000");
    }
    if (
      revision !== undefined &&
      (page.revision !== revision || page.total !== total)
    ) throw Error("Report changed; retry");
    revision = page.revision;
    total = page.total;
    if (!page.rows.length && rows.length < total) {
      throw Error("Incomplete export");
    }
    rows.push(...page.rows);
  } while (rows.length < (total ?? 0));
  if (
    rows.length !== total || new Set(rows.map((r) => r.id)).size !== rows.length
  ) throw Error("Inconsistent export");
  return rows;
}
