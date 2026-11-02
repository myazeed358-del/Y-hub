import { useRef, useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  parsePages,
  PracticeSourceError,
  type PracticeSource,
} from "../sourcesRepository";
import type { Outline, OutlineSection } from "./contracts";
import { outlineRepository } from "./repository";
import { outlineCopy } from "./copy";
type Draft = Omit<OutlineSection, "pages"> & { pages: string };
export function OutlineEditor({
  outline,
  source,
  onSaved,
  onCancel,
  onDenied,
}: {
  outline: Outline;
  source: PracticeSource;
  onSaved: () => void;
  onCancel: () => void;
  onDenied: () => void;
}) {
  const { language } = useLanguage(),
    t = outlineCopy[language];
  const [draft, setDraft] = useState<Draft[]>(() =>
      outline.sections.map((s) => ({ ...s, pages: s.pages.join(",") })),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true),
    running = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const patch = (id: string, change: Partial<Draft>) =>
    setDraft((rows) =>
      rows.map((s) => (s.id === id ? { ...s, ...change } : s)),
    );
  const add = (kind: Draft["kind"]) =>
    setDraft((rows) => [
      ...rows,
      { id: crypto.randomUUID(), kind, title: "", parentId: null, pages: "" },
    ]);
  async function save() {
    if (running.current) return;
    let sections: OutlineSection[];
    try {
      sections = draft.map((s) => ({
        ...s,
        title: s.title.trim(),
        pages: parsePages(s.pages, source.pages),
      }));
      if (
        sections.some(
          (s) =>
            !s.title ||
            s.title.length > 160 ||
            !s.pages.length ||
            (s.parentId &&
              !sections.find(
                (p) =>
                  p.id === s.parentId &&
                  p.kind === "chapter" &&
                  s.pages.every((page) => p.pages.includes(page)),
              )),
        )
      )
        throw new Error();
    } catch {
      setError(t.invalid);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await outlineRepository.save(
        source.id,
        outline.sourceRevision,
        outline.revision,
        sections,
      );
      if (live.current) onSaved();
    } catch (e) {
      if (live.current) {
        const kind = e instanceof PracticeSourceError ? e.kind : "unavailable";
        setError(
          kind === "conflict"
            ? t.conflict
            : kind === "denied"
              ? t.denied
              : t.error,
        );
        if (kind === "denied") onDenied();
      }
    } finally {
      running.current = false;
      if (live.current) setBusy(false);
    }
  }
  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  return (
    <fieldset disabled={busy} className="space-y-3 rounded border p-3 min-w-0">
      <legend>{t.edit}</legend>
      <p className="text-sm">{t.editNote}</p>
      {draft.map((s, index) => (
        <div key={s.id} className="rounded border p-2 space-y-2 min-w-0">
          <p>
            {t[s.kind]} <bdi dir="ltr">{index + 1}</bdi>
          </p>
          <label className="block">
            {t.name} {index + 1}
            <input
              dir="auto"
              maxLength={160}
              className="block w-full rounded border bg-background p-2"
              value={s.title}
              onChange={(e) => patch(s.id, { title: e.target.value })}
            />
          </label>
          <label className="block">
            {t.pages} {index + 1}
            <input
              dir="ltr"
              maxLength={1500}
              className="block w-full rounded border bg-background p-2"
              value={s.pages}
              onChange={(e) => patch(s.id, { pages: e.target.value })}
            />
          </label>
          {s.kind === "topic" && (
            <label className="block">
              {t.parent} {index + 1}
              <select
                className="block max-w-full rounded border bg-background p-2"
                value={s.parentId ?? ""}
                onChange={(e) =>
                  patch(s.id, { parentId: e.target.value || null })
                }
              >
                <option value="">{t.none}</option>
                {draft
                  .filter((p) => p.kind === "chapter")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || t.chapter}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className={button}
            onClick={() =>
              setDraft((rows) =>
                rows
                  .filter((r) => r.id !== s.id)
                  .map((r) =>
                    r.parentId === s.id ? { ...r, parentId: null } : r,
                  ),
              )
            }
          >
            {t.remove} {index + 1}
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={draft.length >= 50}
          onClick={() => add("chapter")}
        >
          {t.addChapter}
        </button>
        <button
          className={button}
          disabled={draft.length >= 50}
          onClick={() => add("topic")}
        >
          {t.addTopic}
        </button>
        <button className={button} onClick={() => void save()}>
          {t.save}
        </button>
        <button className={button} onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </fieldset>
  );
}
