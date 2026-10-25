import { z } from "zod";
import { academicRpc } from "@/shared/academic/lectures";
const record = z.object({
  id: z.string(),
  session_id: z.string(),
  student_id: z.string(),
  full_name: z.string().nullable(),
  user_number: z.string().regex(/^[0-9]{9}$/),
  title: z.string(),
  starts_at: z.string(),
  status: z.enum(["present", "absent", "excused"]),
  method: z.string(),
  state: z.string(),
});
const report = z.object({
  rows: z.array(record),
  total: z.number(),
  stats: z.object({
    eligible: z.number(),
    absent: z.number(),
    present: z.number(),
    excused: z.number(),
  }),
});
export type AttendanceReport = z.infer<typeof report>;
export const attendanceRepository = {
  sections() {
    return academicRpc(
      "my_attendance_sections",
      {},
      z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          section_label: z.string().nullable(),
        }),
      ),
    );
  },
  session(lecture: string) {
    return academicRpc(
      "get_attendance_session",
      { p_lecture: lecture },
      z.object({
        id: z.string(),
        state: z.enum(["open", "closed", "cancelled"]),
        expires_at: z.string(),
        qr_interval_seconds: z.number(),
        serverTime: z.string(),
      }).nullable(),
    );
  },
  open(lecture: string, duration = 10, interval = 10) {
    return academicRpc("open_attendance_v2", {
      p_lecture: lecture,
      p_duration_minutes: duration,
      p_qr_seconds: interval,
    }, z.string().uuid());
  },
  extend(id: string, minutes: number) {
    return academicRpc("extend_attendance", {
      p_session: id,
      p_minutes: minutes,
    }, z.literal(id));
  },
  cancel(id: string) {
    return academicRpc("cancel_attendance", { p_session: id }, z.literal(id));
  },
  close(id: string) {
    return academicRpc("close_attendance", { p_session: id }, z.literal(id));
  },
  qr(id: string) {
    return academicRpc(
      "attendance_qr",
      { p_session: id },
      z.object({
        token: z.string(),
        expiresAt: z.string(),
        serverTime: z.string(),
        intervalSeconds: z.number(),
      }),
    );
  },
  checkIn(token: string) {
    return academicRpc(
      "check_in_attendance",
      { p_token: token },
      z.string().uuid(),
    );
  },
  correct(session: string, student: string, status: string, reason?: string) {
    return academicRpc("correct_attendance", {
      p_session: session,
      p_student: student,
      p_status: status,
      p_reason: reason ?? null,
    }, z.string().uuid());
  },
  report(course: string, offset = 0) {
    return academicRpc("attendance_report", {
      p_course: course,
      p_offset: offset,
      p_limit: 100,
    }, report);
  },
  sessionRoster(session: string) {
    return academicRpc(
      "attendance_session_roster_v2",
      { p_session: session },
      z.array(
        z.object({
          student_id: z.string(),
          full_name: z.string().nullable(),
          user_number: z.string().regex(/^[0-9]{9}$/),
        }),
      ),
    );
  },
  async roster(course: string) {
    return academicRpc(
      "get_managed_course_enrollment_roster_v2",
      { p_course_id: course },
      z.array(
        z.object({
          student_id: z.string(),
          full_name: z.string().nullable(),
          user_number: z.string().regex(/^[0-9]{9}$/),
        }),
      ),
    );
  },
};
/** Formula-safe CSV; data stays within the authorized report RPC. */
export function attendanceCsv(rows: AttendanceReport["rows"]) {
  const cell = (value: string) =>
    '"' +
    (/^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll(
      '"',
      '""',
    ) + '"';
  return "\uFEFF" +
    [
      ["Student", "Y-Hub number", "Lecture", "Date", "Status", "Session state"],
      ...rows.map(
        (r) => [
          r.full_name ?? "",
          r.user_number,
          r.title,
          r.starts_at,
          r.status,
          r.state,
        ],
      ),
    ].map((row) => row.map(cell).join(",")).join("\r\n");
}
