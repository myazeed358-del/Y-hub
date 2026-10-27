import { useEffect, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { attendanceRepository as repo } from "./repository";
import { QrPanel } from "./QrPanel";

type Props = {
  lecture: string;
  mode?: "all" | "session" | "qr" | "students";
  ar: boolean;
  version: number;
  busy: boolean;
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
};
/** The parent keys this component by account/lecture; no stale roster crosses contexts. */
export function AttendanceSessionPanel(
  { lecture, ar, version, busy, mutate, mode = "all" }: Props,
) {
  const [session, setSession] = useState<
    Awaited<ReturnType<typeof repo.session>>
  >(null);
  const [roster, setRoster] = useState<
    Awaited<ReturnType<typeof repo.sessionRoster>>
  >([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const [duration, setDuration] = useState(10),
    [interval, setIntervalSeconds] = useState(10),
    [extension, setExtension] = useState(5);
  const [student, setStudent] = useState(""),
    [status, setStatus] = useState<"present" | "absent">("present");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const s = await repo.session(lecture);
        // Show the roster saved for this session only when its view needs it.
        const rows = s && (mode === "all" || mode === "students")
          ? await repo.sessionRoster(s.id)
          : [];
        if (!active) return;
        setSession(s);
        setRoster(rows);
        setError(false);
        setLoading(false);
      } catch {
        if (active) {
          setError(true);
          setSession(null);
          setRoster([]);
          setLoading(false);
        }
      }
      if (active) timer = setTimeout(() => void refresh(), 5000);
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lecture, version, mode]);
  const field = "w-full rounded-md border border-border bg-background p-2";
  const labels = {
    open: ar ? "مفتوحة" : "Open",
    closed: ar ? "مغلقة" : "Closed",
    cancelled: ar ? "ملغاة" : "Cancelled",
  };
  if (loading) {
    return <p role="status">{ar ? "جارٍ تحميل الجلسة…" : "Loading session…"}</p>;
  }
  if (error) {
    return (
      <p role="alert">
        {ar
          ? "تعذر التحقق من الجلسة. ستتم إعادة المحاولة."
          : "Could not verify session. Retrying."}
      </p>
    );
  }
  if (!session && mode !== "session" && mode !== "all") {
    return (
      <p>
        {ar
          ? "افتح جلسة حضور من تبويب الجلسات أولًا."
          : "Open attendance from Sessions first."}
      </p>
    );
  }
  if (session && mode === "qr") {
    return (
      <div className="space-y-3">
        <p>{labels[session.state]}</p>
        {session.state === "open"
          ? <QrPanel session={session.id} ar={ar} />
          : (
            <p>
              {ar
                ? "لا يوجد رمز صالح لجلسة مغلقة أو ملغاة."
                : "Closed or cancelled sessions have no valid QR."}
            </p>
          )}
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {!session
        ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(() => repo.open(lecture, duration, interval));
            }}
          >
            <label className="block">
              {ar
                ? "مدة الحضور بالدقائق (1–120)"
                : "Attendance duration in minutes (1–120)"}
              <input
                className={field}
                type="number"
                min={1}
                max={120}
                step={1}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 30, 60].map((n) => (
                <Button
                  type="button"
                  variant="outline"
                  key={n}
                  onClick={() => setDuration(n)}
                >
                  {n} {ar ? "دقيقة" : "min"}
                </Button>
              ))}
            </div>
            <label className="block">
              {ar
                ? "تدوير QR بالثواني (10–120)"
                : "QR rotation in seconds (10–120)"}
              <input
                className={field}
                type="number"
                min={10}
                max={120}
                step={1}
                required
                value={interval}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 30, 60].map((n) => (
                <Button
                  type="button"
                  variant="outline"
                  key={n}
                  onClick={() => setIntervalSeconds(n)}
                >
                  {n} {ar ? "ثانية" : "sec"}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "تدوير الرمز مستقل عن مدة الجلسة. تُثبّت قائمة الطلاب المؤهلين عند الفتح."
                : "QR rotation is independent of session duration. Eligible students are fixed when attendance opens."}
            </p>
            <Button disabled={busy}>
              {ar ? "فتح جلسة حضور" : "Open attendance"}
            </Button>
          </form>
        )
        : (
          <>
            <p role="status">
              {labels[session.state]} · {ar ? "موعد الإغلاق" : "Closes at"}{" "}
              <time dateTime={session.expires_at}>
                {new Date(session.expires_at).toLocaleString(ar ? "ar" : "en")}
              </time>
            </p>
            {session.state === "open" && mode !== "students" && (
              <>
                {mode === "all" && <QrPanel session={session.id} ar={ar} />}
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate(() => repo.extend(session.id, extension));
                  }}
                >
                  <label>
                    {ar ? "دقائق إضافية" : "Additional minutes"}
                    <input
                      className={field}
                      type="number"
                      min={1}
                      max={120}
                      step={1}
                      value={extension}
                      onChange={(e) => setExtension(Number(e.target.value))}
                    />
                  </label>
                  <Button disabled={busy}>
                    {ar ? "تمديد الجلسة" : "Extend session"}
                  </Button>
                </form>
                <p className="text-sm">
                  {ar
                    ? "المدة الإجمالية لا تتجاوز 120 دقيقة. لا يُعاد فتح الجلسة بعد انتهائها."
                    : "Total duration cannot exceed 120 minutes. Expired sessions cannot reopen."}
                </p>
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        ar ? "إغلاق الحضور الآن؟" : "Close attendance now?",
                      )
                    ) void mutate(() => repo.close(session.id));
                  }}
                >
                  {ar ? "إغلاق الجلسة" : "Close session"}
                </Button>
              </>
            )}
            {session.state !== "cancelled" && (
              <>
                {mode !== "session" && (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutate(() =>
                        repo.correct(session.id, student, status)
                      );
                    }}
                  >
                    <h2>
                      {ar
                        ? "تسجيل أو تصحيح يدوي"
                        : "Manual attendance or correction"}
                    </h2>
                    <label className="block">
                      {ar ? "الطالب" : "Student"}
                      <select
                        className={field}
                        required
                        value={student}
                        onChange={(e) => setStudent(e.target.value)}
                      >
                        <option value="">—</option>
                        {roster.map((s) => (
                          <option key={s.student_id} value={s.student_id}>
                            {s.full_name ?? "—"} · {s.user_number}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      {ar ? "الحالة" : "Status"}
                      <select
                        className={field}
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as "present" | "absent")}
                      >
                        <option value="present">
                          {ar ? "حاضر" : "Present"}
                        </option>
                        <option value="absent">{ar ? "غائب" : "Absent"}</option>
                      </select>
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {ar
                        ? "لا يلزم سبب مكتوب. يُحفظ التعديل في سجل التدقيق دون إشعار الطالب."
                        : "No written reason is required. Changes are audited without notifying the student."}
                    </p>
                    <Button disabled={busy}>
                      {ar ? "حفظ التصحيح" : "Save correction"}
                    </Button>
                  </form>
                )}
                {mode !== "students" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          ar
                            ? "إلغاء جلسة الحضور واستبعادها من النسب مع حفظ سجلها؟"
                            : "Cancel attendance and exclude it from statistics while preserving history?",
                        )
                      ) void mutate(() => repo.cancel(session.id));
                    }}
                  >
                    {ar ? "إلغاء جلسة الحضور" : "Cancel attendance session"}
                  </Button>
                )}
              </>
            )}
          </>
        )}
    </div>
  );
}
