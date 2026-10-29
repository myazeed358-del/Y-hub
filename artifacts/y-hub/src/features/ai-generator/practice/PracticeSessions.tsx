import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  sessionsRepository,
  PracticeSessionError,
  type PracticeScope,
  type SessionSettings,
  type SessionSummary,
} from "./sessionsRepository";
import { PracticeSessionView } from "./PracticeSessionView";
import { sessionCopy } from "./sessionCopy";
const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
export function PracticeSessions({
  courseId,
  getScope,
}: {
  courseId: string;
  getScope: () => PracticeScope;
}) {
  const { language } = useLanguage(),
    t = sessionCopy[language];
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState<SessionSettings>({
      mode: "practice",
      difficulty: "medium",
      language,
      target: 5,
      allowRepeats: false,
    });
  const [rows, setRows] = useState<SessionSummary[]>([]),
    [offset, setOffset] = useState(0),
    [id, setId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    running = useRef(false),
    creation = useRef<{ id: string; signature: string } | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const report = (e: unknown) => {
    const kind = e instanceof PracticeSessionError ? e.kind : "unavailable";
    setError(t[kind]);
    if (kind === "denied") {
      setRows([]);
      setId(null);
      setDirty(false);
    }
  };
  async function list(page: number) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await sessionsRepository.list(courseId, page);
      if (alive.current) {
        setRows(data);
        setOffset(page);
      }
    } catch (e) {
      if (alive.current) report(e);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function create() {
    if (dirty) {
      setError(t.leave);
      return;
    }
    if (running.current) return;
    let scope: PracticeScope;
    try {
      scope = getScope();
      if (
        !scope.selection.length ||
        !Number.isInteger(settings.target) ||
        settings.target < 1 ||
        settings.target > 100
      )
        throw new Error();
    } catch {
      setError(t.scope);
      return;
    }
    const signature = JSON.stringify({ scope, settings });
    if (creation.current?.signature !== signature)
      creation.current = { id: crypto.randomUUID(), signature };
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await sessionsRepository.create(
        creation.current.id,
        courseId,
        scope,
        settings,
      );
      if (alive.current) {
        setId(next);
        creation.current = null;
      }
    } catch (e) {
      if (alive.current) report(e);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t pt-3 min-w-0">
      <button
        className={button}
        aria-expanded={open}
        onClick={() => {
          if (dirty) {
            setError(t.leave);
            return;
          }
          setOpen(!open);
          if (!open) void list(0);
        }}
      >
        {t.title}
      </button>
      {error && <p role="alert">{error}</p>}
      {open && (
        <>
          <fieldset disabled={busy || dirty} className="space-y-2">
            <legend>{t.new}</legend>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={language === "ar" ? "وضع الجلسة" : "Session mode"}
                className="rounded border bg-background p-2"
                value={settings.mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    mode: e.target.value as SessionSettings["mode"],
                  })
                }
              >
                <option value="practice">{t.practice}</option>
                <option value="exam">{t.exam}</option>
              </select>
              <label>
                {t.difficulty}
                <select
                  className="rounded border bg-background p-2"
                  value={settings.difficulty}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      difficulty: e.target
                        .value as SessionSettings["difficulty"],
                    })
                  }
                >
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <option key={d} value={d}>
                      {t[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.language}
                <select
                  className="rounded border bg-background p-2"
                  value={settings.language}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      language: e.target.value as "ar" | "en",
                    })
                  }
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <label className="block">
              {t.count}
              <input
                className="ms-2 w-20 rounded border bg-background p-2"
                dir="ltr"
                type="number"
                min={1}
                max={100}
                value={settings.target}
                onChange={(e) =>
                  setSettings({ ...settings, target: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={settings.allowRepeats}
                onChange={(e) =>
                  setSettings({ ...settings, allowRepeats: e.target.checked })
                }
              />
              {t.repeats}
            </label>
            <button className={button} onClick={() => void create()}>
              {busy ? t.working : t.create}
            </button>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() => void list(offset)}
            >
              {t.history}
            </button>
            <button
              className={button}
              disabled={busy || offset === 0}
              onClick={() => void list(Math.max(0, offset - 20))}
            >
              {t.previous}
            </button>
            <button
              className={button}
              disabled={busy || rows.length < 20}
              onClick={() => void list(offset + 20)}
            >
              {t.next}
            </button>
          </div>
          {!busy && !rows.length && <p>{t.empty}</p>}
          {rows.map((row) => (
            <button
              key={row.id}
              className={`${button} block w-full text-start`}
              disabled={busy || dirty}
              onClick={() => setId(row.id)}
            >
              <span>
                {t[row.mode]} · {row.target} ·{" "}
                {row.submitted_at ? t.completed : t.pending}
              </span>{" "}
              <bdi>{new Date(row.updated_at).toLocaleString(language)}</bdi>
            </button>
          ))}
          {id && <PracticeSessionView key={id} id={id} onDirty={setDirty} />}
        </>
      )}
    </div>
  );
}
