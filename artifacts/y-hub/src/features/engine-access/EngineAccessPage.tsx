import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { ENGINE_CATALOG } from "@/config/majorEngineAccess";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { engineAccessRepository as repo } from "./repository";
import type { StudentMatch } from "./workflowRepository";
import { StudentSearch } from "./components/StudentSearch";
import { GrantForm } from "./components/GrantForm";
import { GrantHistory } from "./components/GrantHistory";
function Workspace(
  { role, language }: { role: string; language: "ar" | "en" },
) {
  const ar = language === "ar";
  const [sections, setSections] = useState<
      Awaited<ReturnType<typeof repo.sections>>
    >([]),
    [engines, setEngines] = useState<string[]>([]),
    [course, setCourse] = useState("");
  const [draft, setDraft] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<StudentMatch | null>(null),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([repo.sections(), repo.engines()]).then(([s, e]) => {
      if (active) {
        setSections(s);
        setEngines(e);
        setLoading(false);
        setSelected((current) =>
          current && s.some((c) => c.id === current.course_id) ? current : null
        );
      }
    }, () => {
      if (active) {
        setSections([]);
        setEngines([]);
        setSelected(null);
        setLoading(false);
        setError(true);
      }
    });
    return () => {
      active = false;
    };
  }, [version]);
  const title = (id: string) =>
    ENGINE_CATALOG.find((e) => e.id === id)?.title[language] ?? id;
  const refresh = () => setVersion((v) => v + 1);
  return (
    <section className="mx-auto max-w-6xl space-y-5" dir={ar ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-bold">
        {ar ? "صلاحيات المحركات الاستثنائية" : "Exceptional engine permissions"}
      </h1>
      <p className="text-muted-foreground">
        {ar
          ? "ابحث بالاسم أو رقم Y-Hub في شعبك المصرح بها، ثم اختر الطالب والشعبة."
          : "Search authorized sections by name or Y-Hub number, then select a student and section."}
      </p>
      {error && (
        <p role="alert">
          {ar
            ? "تعذر التحقق من الشعب والمحركات."
            : "Unable to verify sections and engines."}
        </p>
      )}
      <form
        className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(null);
          setSearch(draft);
        }}
      >
        <label className="min-w-0">
          {ar ? "اسم الطالب أو رقمه الجامعي" : "Student name or number"}
          <input
            className="w-full rounded border border-border bg-background p-2"
            maxLength={100}
            value={draft}
            onChange={(e) =>
              setDraft(e.target.value)}
          />
        </label>
        <label>
          {ar ? "الشعبة" : "Section"}
          <select
            className="w-full rounded border border-border bg-background p-2"
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">
              {ar ? "كل الشعب المصرح بها" : "All authorized sections"}
            </option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.section_label}
              </option>
            ))}
          </select>
        </label>
        <Button>{ar ? "بحث" : "Search"}</Button>
      </form>
      {loading && <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <StudentSearch
          key={`${course}:${search}`}
          course={course}
          search={search}
          version={version}
          ar={ar}
          onSelect={setSelected}
        />
        <div className="min-w-0 space-y-4">
          {selected && (
            <>
              <section className="space-y-2 rounded-xl border border-border bg-card p-4">
                <h2 className="text-lg font-semibold">
                  {ar ? "ملف الطالب" : "Student profile"}
                </h2>
                <p>{selected.full_name ?? "—"}</p>
                <p dir="ltr" className="font-mono">{selected.user_number}</p>
                <p>{selected.title} · {selected.section_label}</p>
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                >
                  {ar ? "عرض كل التصاريح" : "Show all permissions"}
                </Button>
              </section>
              {role === "instructor" && !loading && !error && (
                <GrantForm
                  key={`${selected.course_id}:${selected.student_id}`}
                  student={selected}
                  engines={engines}
                  title={title}
                  ar={ar}
                  onSaved={refresh}
                />
              )}
            </>
          )}
          <GrantHistory
            key={`${selected?.course_id ?? course}:${
              selected?.student_id ?? ""
            }`}
            course={selected?.course_id ?? course}
            student={selected?.student_id ?? ""}
            version={version}
            ar={ar}
            title={title}
            onSaved={refresh}
          />
        </div>
      </div>
      <Button variant="outline" disabled={loading} onClick={refresh}>
        {ar ? "تحديث" : "Refresh"}
      </Button>
    </section>
  );
}
export default function EngineAccessPage() {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  if (!user || !role) return null;
  return (
    <Workspace key={`${user.id}:${role}`} role={role} language={language} />
  );
}
