import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PracticeSessionError } from "../sessionsRepository";
import { performanceCopy } from "./copy";
import { performanceRepository, type Performance } from "./repository";
export function WeightEditor({
  courseId,
  weights,
  draft: pending,
  onDraft,
  onSaved,
  onDenied,
}: {
  courseId: string;
  weights: Performance["weights"];
  draft: Performance["weights"] | null;
  onDraft: (draft: Performance["weights"] | null) => void;
  onSaved: () => void;
  onDenied: () => void;
}) {
  const { language } = useLanguage(),
    t = performanceCopy[language];
  const draft = pending ?? weights,
    dirty = pending !== null;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save() {
    if (running.current) return;
    if (
      ![draft.practice, draft.exam].every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 100,
      ) ||
      draft.practice + draft.exam !== 100
    ) {
      setError(t.invalid);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await performanceRepository.save(
        courseId,
        draft.revision,
        draft.practice,
        draft.exam,
      );
      if (alive.current) {
        onSaved();
      }
    } catch (e) {
      if (alive.current) {
        const kind = e instanceof PracticeSessionError ? e.kind : "unavailable";
        setError(
          kind === "denied"
            ? t.denied
            : kind === "conflict"
              ? t.conflict
              : t.error,
        );
        if (kind === "denied") onDenied();
      }
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="space-y-2 rounded border p-3">
      <legend>{t.weights}</legend>
      <p className="text-sm">{t.weightHelp}</p>
      <div className="flex flex-wrap gap-3">
        {(["practice", "exam"] as const).map((mode) => (
          <label key={mode}>
            {t[mode]} (%)
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              dir="ltr"
              className="ms-2 w-20 rounded border bg-background p-2"
              value={draft[mode]}
              onChange={(e) => {
                onDraft({ ...draft, [mode]: e.target.valueAsNumber });
              }}
            />
          </label>
        ))}
      </div>
      {dirty && draft.revision !== weights.revision && (
        <p role="status">{t.changed}</p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-3 py-2"
          onClick={() => void save()}
        >
          {t.save}
        </button>
        <button
          className="rounded border px-3 py-2"
          onClick={() => {
            onDraft(null);
            setError("");
          }}
        >
          {t.useCurrent}
        </button>
      </div>
    </fieldset>
  );
}
