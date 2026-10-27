import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { authorizedSectionSelection } from "@/shared/academic/SectionActivityLinks";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/y-hub-ds/components/ui/tabs";
import {
  type AcademicLecture,
  academicLectures as lectures,
} from "@/shared/academic/lectures";
import { attendanceRepository as repo } from "./repository";
import { AttendanceSessionPanel } from "./AttendanceSessionPanel";
import { AttendanceReport } from "./AttendanceReport";
import { AttendanceStudents } from "./AttendanceStudents";
import { LectureScheduler } from "./LectureScheduler";
function Workspace(
  { userId, role, ar }: { userId: string; role: string; ar: boolean },
) {
  const manager = ["instructor", "admin", "super_admin"].includes(role);
  const [sections, setSections] = useState<
      Awaited<ReturnType<typeof repo.sections>>
    >([]),
    [course, setCourse] = useState(""),
    [items, setItems] = useState<AcademicLecture[]>([]),
    [lecture, setLecture] = useState("");
  const [token, setToken] = useState(() => window.location.hash.slice(1)),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [success, setSuccess] = useState(false);
  const [tab, setTab] = useState(manager ? "sessions" : "qr");
  const inFlight = useRef(false);
  useEffect(() => {
    // Clear the check-in token from the address bar after reading it.
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  useEffect(() => {
    let active = true;
    repo.sections().then((s) => {
      if (active) {
        setSections(s);
        setCourse((c) =>
          authorizedSectionSelection(window.location.search, s, c)
        );
        setLoading(false);
      }
    }, () => {
      if (active) {
        setSections([]);
        setCourse("");
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [version]);
  useEffect(() => {
    setLecture("");
  }, [course, offset]);
  useEffect(() => {
    let active = true;
    setItems([]);
    if (!course) {
      setLoading(false);
      return;
    }
    setLoading(true);
    lectures.list(course, offset).then((rows) => {
      if (active) {
        setItems(rows);
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
  }, [course, offset, version]);
  async function mutate(fn: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
    }
  }
  const field = "w-full rounded-md border border-border bg-background p-2";
  const labels = [
    ["sessions", ar ? "الجلسات" : "Sessions"],
    ["qr", "QR"],
    ...(manager ? [["students", ar ? "الطلاب" : "Students"]] : []),
    ["history", ar ? "السجل" : "History"],
    ["analytics", ar ? "التحليلات" : "Analytics"],
    ["reports", ar ? "التقارير" : "Reports"],
  ];
  const choose = (
    <p>
      {ar
        ? "اختر الشعبة والمحاضرة أولًا."
        : "Choose a section and lecture first."}
    </p>
  );
  return (
    <section dir={ar ? "rtl" : "ltr"} className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Y-Attendance</h1>
      {error && (
        <p role="alert">
          {ar
            ? "لم تتأكد العملية. تحقق من الاتصال والصلاحيات ثم حدّث."
            : "Operation not confirmed. Check connection and permissions, then refresh."}
        </p>
      )}
      {success && (
        <p role="status">
          {ar ? "أكد الخادم إتمام الطلب." : "The server confirmed the request."}
        </p>
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
      {course && (
        <div className="space-y-2">
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
                  {l.title} ·{" "}
                  {new Date(l.starts_at).toLocaleString(ar ? "ar" : "en")}
                  {l.cancelled ? " ×" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!offset || busy}
              onClick={() =>
                setOffset(Math.max(0, offset - 50))}
            >
              {ar ? "المحاضرات السابقة" : "Previous lectures"}
            </Button>
            <Button
              variant="outline"
              disabled={items.length < 50 || busy}
              onClick={() =>
                setOffset(offset + 50)}
            >
              {ar ? "المحاضرات التالية" : "Next lectures"}
            </Button>
          </div>
        </div>
      )}
      <Tabs dir={ar ? "rtl" : "ltr"} value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {labels.map(([value, label]) => (
            <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="sessions" className="space-y-4">
          {course && manager && (
            <LectureScheduler
              key={course}
              course={course}
              ar={ar}
              busy={busy}
              mutate={mutate}
            />
          )}
          {manager && lecture
            ? (
              <>
                <AttendanceSessionPanel
                  key={`${userId}:${lecture}`}
                  lecture={lecture}
                  ar={ar}
                  version={version}
                  busy={busy}
                  mutate={mutate}
                  mode="session"
                />
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
              </>
            )
            : choose}
        </TabsContent>
        <TabsContent value="qr">
          {role === "student"
            ? (
              <form
                className="space-y-3 rounded-xl border border-border p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(() => repo.checkIn(token.trim()));
                }}
              >
                <label>
                  {ar ? "رمز QR من المحاضرة" : "Lecture QR token"}
                  <input
                    className={field}
                    required
                    autoComplete="off"
                    value={token}
                    onChange={(e) =>
                      setToken(e.target.value)}
                  />
                </label>
                <Button disabled={busy}>
                  {ar ? "تأكيد الحضور" : "Confirm attendance"}
                </Button>
                <p>
                  {ar
                    ? "افتح الرمز بكاميرا الهاتف وأكد قبل انتهاء صلاحيته."
                    : "Open the QR with your phone camera and confirm before expiry."}
                </p>
              </form>
            )
            : lecture
            ? (
              <AttendanceSessionPanel
                key={lecture}
                lecture={lecture}
                ar={ar}
                version={version}
                busy={busy}
                mutate={mutate}
                mode="qr"
              />
            )
            : choose}
        </TabsContent>
        {manager && (
          <TabsContent value="students" className="space-y-4">
            {course
              ? (
                <AttendanceStudents
                  key={course}
                  course={course}
                  ar={ar}
                  version={version}
                />
              )
              : choose}
            {lecture && (
              <AttendanceSessionPanel
                key={lecture}
                lecture={lecture}
                ar={ar}
                version={version}
                busy={busy}
                mutate={mutate}
                mode="students"
              />
            )}
          </TabsContent>
        )}
        {(["history", "analytics", "reports"] as const).map((mode) => (
          <TabsContent key={mode} value={mode}>
            {course
              ? (
                <AttendanceReport
                  key={`${userId}:${course}:${mode}`}
                  course={course}
                  version={version}
                  ar={ar}
                  lectures={items}
                  mode={mode}
                />
              )
              : choose}
          </TabsContent>
        ))}
      </Tabs>
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
export default function AttendancePage() {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  if (!user || !role) return null;
  return (
    <Workspace
      key={`${user.id}:${role}`}
      userId={user.id}
      role={role}
      ar={language === "ar"}
    />
  );
}
