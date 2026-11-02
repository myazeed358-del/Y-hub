import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PracticeSourceError, type PracticeSource } from "../sourcesRepository";
import type { Outline, OutlineChoice } from "./contracts";
import { outlineRepository } from "./repository";
import { outlineCopy } from "./copy";
import { OutlineEditor } from "./OutlineEditor";
export function SourceOutline(props: {
  source: PracticeSource;
  choice?: OutlineChoice;
  disabled: boolean;
  onChoose: (choice: OutlineChoice | undefined, pages: number[]) => void;
  onChanged: () => void;
}) {
  const { language } = useLanguage(),
    t = outlineCopy[language];
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 space-y-2">
      <button
        className="rounded border px-3 py-2 text-sm"
        disabled={props.disabled}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t.title}: {props.source.title}
      </button>
      {open && <OutlinePanel key={props.source.revision} {...props} />}
    </div>
  );
}
function OutlinePanel({
  source,
  choice,
  disabled,
  onChoose,
  onChanged,
}: Parameters<typeof SourceOutline>[0]) {
  const { language } = useLanguage(),
    t = outlineCopy[language];
  const [data, setData] = useState<Outline | null>(null),
    [epoch, setEpoch] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    setLoading(true);
    outlineRepository
      .read(source.id, c.signal)
      .then((value) => {
        if (!c.signal.aborted) {
          if (value.sourceRevision !== source.revision)
            throw new PracticeSourceError("conflict");
          setData(value);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            e instanceof PracticeSourceError && e.kind === "denied"
              ? t.denied
              : e instanceof PracticeSourceError && e.kind === "conflict"
                ? t.mismatch
                : t.error,
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [source.id, source.revision, epoch]);
  const denied = () => {
    setData(null);
    setEditing(false);
    setError(t.denied);
  };
  const select = (ids: string[]) => {
    if (!data) return;
    const pages = [
      ...new Set(
        data.sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.pages),
      ),
    ].sort((a, b) => a - b);
    onChoose(ids.length ? { revision: data.revision, ids } : undefined, pages);
  };
  return (
    <div className="min-w-0 space-y-2" aria-label={t.title}>
      <p className="text-sm">{t.note}</p>
      {loading && <p role="status">{t.loading}</p>}
      {error && <p role="alert">{error}</p>}
      {!editing && (
        <button
          className="rounded border px-3 py-2 text-sm"
          disabled={disabled || loading}
          onClick={() => setEpoch((n) => n + 1)}
        >
          {t.reload}
        </button>
      )}
      {data && (
        <>
          {data.stale && <p role="status">{t.stale}</p>}
          {choice && choice.revision !== data.revision && (
            <p role="alert">{t.conflict}</p>
          )}
          {!data.sections.length && <p>{t.empty}</p>}
          {!editing && (
            <fieldset disabled={disabled || data.stale} className="space-y-2">
              {data.sections.map((s) => (
                <label key={s.id} className="flex items-start gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={
                      (choice?.revision === data.revision &&
                        choice.ids.includes(s.id)) ||
                      false
                    }
                    onChange={(e) =>
                      select(
                        e.target.checked
                          ? [
                              ...(choice?.revision === data.revision
                                ? choice.ids
                                : []),
                              s.id,
                            ]
                          : (choice?.ids ?? []).filter((id) => id !== s.id),
                      )
                    }
                  />
                  <span className="break-words min-w-0">
                    {t[s.kind]}: {s.title} —{" "}
                    <bdi dir="ltr">{s.pages.join(", ")}</bdi>
                  </span>
                </label>
              ))}
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={() => onChoose(undefined, [])}
              >
                {t.clear}
              </button>
            </fieldset>
          )}
          {data.canManage && !editing && (
            <button
              className="rounded border px-3 py-2 text-sm"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              {t.edit}
            </button>
          )}
          {data.canManage && editing && (
            <OutlineEditor
              outline={data}
              source={source}
              onCancel={() => setEditing(false)}
              onDenied={denied}
              onSaved={onChanged}
            />
          )}
        </>
      )}
    </div>
  );
}
