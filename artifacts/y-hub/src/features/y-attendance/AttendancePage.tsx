import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import {
  type AcademicLecture,
  academicLectures as lectures,
} from "@/shared/academic/lectures";
import { attendanceRepository as repo } from "./repository";
import { AttendanceSessionPanel } from "./AttendanceSessionPanel";
import { AttendanceReport } from "./AttendanceReport";
export default function AttendancePage() {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const ar = language === "ar",
    manager = role === "instructor" || role === "admin" ||
      role === "super_admin";
  const [sections, setSections] = useState<
      Awaited<ReturnType<typeof lectures.sections>>
    >([]),
    [course, setCourse] = useState(""),
    [items, setItems] = useState<AcademicLecture[]>([]),
    [lecture, setLecture] = useState("");
  const [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [token, setToken] = useState(() => window.location.hash.slice(1)),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [success, setSuccess] = useState(false);
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  useEffect(() => {
    setCourse("");
    setSections([]);
    setLecture("");
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    repo.sections().then((s) => {
      if (active) {
        setSections(s);
        setLoading(false);
      }
    }, () => {
      if (active) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id, version]);
  useEffect(() => {
    let active = true;
    setItems([]);
    if (!course) return;
    setLoading(true);
    lectures.list(course, offset).then((l) => {
      if (active) {
        setItems(l);
        setLoading(false);
      }
    }, () => {
      if (active) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [course, user?.id, offset, version]);
  async function mutate(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setSuccess(false);
    try {
      await fn();
      setSuccess(true);
      setVersion((v) => v + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const field = "w-full rounded-md border border-border bg-background p-2";
  return (
    <section dir={ar ? "rtl" : "ltr"} className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Y-Attendance</h1>
      {error && (
        <p role="alert">
          {ar
            ? "لم تتأكد العملية. تحقق من الاتصال والصلاحيات وحالة الجلسة ثم حدّث."
            : "Operation not confirmed. Check connection, permissions and session status, then refresh."}
        </p>
      )}
      {success && (
        <p role="status">
          {ar ? "أكد الخادم إتمام الطلب." : "The server confirmed the request."}
        </p>
      )}
      {role === "student" && (
        <form
          className="space-y-2 border border-border rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(() => repo.checkIn(token.trim()));
          }}
        >
          <label>
            {ar ? "رمز QR من المحاضرة" : "Lecture QR token"}
            <input
              className={field}
              value={token}
              onChange={(e) =>
                setToken(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <Button disabled={busy}>
            {ar ? "تأكيد الحضور" : "Confirm attendance"}
          </Button>
          <p className="text-sm">
            {ar
              ? "افتح الرمز بكاميرا الهاتف وأكد خلال صلاحيته؛ عند انتهائه امسح الرمز الجديد."
              : "Open the QR with your phone camera and confirm before expiry; scan the new code if it expires."}
          </p>
        </form>
      )}
      <label>
        {ar ? "الشعبة" : "Section"}
        <select
          className={field}
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setLecture("");
            setOffset(0);
          }}
        >
          <option value="">—</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.title} {s.section_label}</option>
          ))}
        </select>
      </label>
      {loading && <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>}
      {course && manager && (
        <form
          className="space-y-3 bg-card border border-border rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(() =>
              lectures.schedule(
                course,
                title,
                new Date(start).toISOString(),
                new Date(end).toISOString(),
              )
            );
          }}
        >
          <h2>{ar ? "جدولة محاضرة للشعبة" : "Schedule a section lecture"}</h2>
          <input
            aria-label={ar ? "العنوان" : "Title"}
            placeholder={ar ? "العنوان" : "Title"}
            required
            maxLength={200}
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label>
            {ar ? "البداية" : "Start"}
            <input
              type="datetime-local"
              required
              className={field}
              value={start}
              onChange={(e) =>
                setStart(e.target.value)}
            />
          </label>
          <label>
            {ar ? "النهاية" : "End"}
            <input
              type="datetime-local"
              required
              className={field}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Button disabled={busy}>{ar ? "جدولة" : "Schedule"}</Button>
        </form>
      )}
      {course && (
        <>
          <label>
            {ar ? "المحاضرة" : "Lecture"}
            <select
              className={field}
              value={lecture}
              onChange={(e) => setLecture(e.target.value)}
            >
              <option value="">—</option>
              {items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} · {new Date(l.starts_at).toLocaleString(language)}
                  {l.cancelled ? " ×" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((x) => Math.max(0, x - 50))}
            >
              {ar ? "السابق" : "Previous"}
            </Button>
            <Button
              variant="outline"
              disabled={items.length < 50}
              onClick={() => setOffset((x) => x + 50)}
            >
              {ar ? "التالي" : "Next"}
            </Button>
          </div>
        </>
      )}
      {manager && lecture && (
        <AttendanceSessionPanel
          key={`${user?.id}:${lecture}`}
          lecture={lecture}
          ar={ar}
          version={version}
          busy={busy}
          mutate={mutate}
        />
      )}
      {manager && lecture && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(ar ? "إلغاء المحاضرة؟" : "Cancel lecture?")
            ) void mutate(() => lectures.cancel(lecture));
          }}
        >
          {ar ? "إلغاء المحاضرة" : "Cancel lecture"}
        </Button>
      )}
      {course && <AttendanceReport course={course} version={version} ar={ar} />}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setError(false);
          setVersion((v) => v + 1);
        }}
      >
        {ar ? "تحديث" : "Refresh"}
      </Button>
    </section>
  );
}
