import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ChatMessageContent } from "../../ai-chat/ChatMessageContent";
import { SourceEvidence } from "../../knowledge/SourceEvidence";
import { PracticeSessionError } from "../sessionsRepository";
import { reviewRepository, type ReviewDetail } from "./repository";
import { reviewCopy } from "./copy";
export const reviewButton =
  "rounded border px-3 py-2 text-sm disabled:opacity-50";
export function ReviewDetailPanel({
  id,
  manage = false,
  onChanged,
  onDenied,
}: {
  id: string;
  manage?: boolean;
  onChanged: () => void;
  onDenied?: () => void;
}) {
  const { language } = useLanguage(),
    t = reviewCopy[language];
  const [data, setData] = useState<ReviewDetail | null>(null),
    [load, setLoad] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [explanation, setExplanation] = useState("");
  const alive = useRef(true),
    running = useRef(false);
  const report = (e: unknown) => {
    const kind = e instanceof PracticeSessionError ? e.kind : "unavailable";
    setError(
      kind === "unavailable"
        ? t.error
        : kind === "insufficient"
          ? t.error
          : t[kind],
    );
    if (kind === "denied" || kind === "conflict") setData(null);
    if (kind === "denied") onDenied?.();
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    reviewRepository
      .detail(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) report(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [id, load]);
  useEffect(() => {
    const focus = () => {
      if (!running.current) setLoad((n) => n + 1);
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  async function apply() {
    if (!data || running.current) return;
    if (
      !["0", "1", "2", "3", "exclude"].includes(selected) ||
      explanation.trim().length < 10
    ) {
      setError(t.invalid);
      return;
    }
    if (!window.confirm(t.confirm)) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await reviewRepository.resolve(
        id,
        data.review.revision,
        selected === "exclude" ? null : Number(selected),
        explanation,
      );
      if (alive.current) {
        setLoad((n) => n + 1);
        onChanged();
      }
    } catch (e) {
      if (alive.current) report(e);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div
      className="rounded border p-3 space-y-3 min-w-0"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <button
        className={reviewButton}
        disabled={busy}
        onClick={() => setLoad((n) => n + 1)}
      >
        {t.reload}
      </button>
      {busy && <p role="status">{t.loading}</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <h4>
            {t.question} <bdi dir="ltr">{data.review.position}</bdi> ·{" "}
            {t[data.review.state]}
          </h4>
          <ChatMessageContent content={data.question.prompt} />
          {data.question.options.map((option, index) => (
            <div key={index} className="flex gap-2 min-w-0">
              <bdi dir="ltr">{index + 1}.</bdi>
              <div className="min-w-0">
                <ChatMessageContent content={option} />
              </div>
            </div>
          ))}
          <p>
            {t.student}: <bdi dir="ltr">{data.question.choice + 1}</bdi> ·{" "}
            {t.initial}:{" "}
            <bdi dir="ltr">{data.question.suggestedChoice + 1}</bdi>
          </p>
          <ChatMessageContent content={data.question.explanation} />
          {data.automatic.explanation && (
            <div className="rounded bg-muted p-3">
              <h5>{t.automatic}</h5>
              <ChatMessageContent content={data.automatic.explanation} />
            </div>
          )}
          {data.resolution && (
            <div className="rounded border p-3">
              <h5>{t.resolution}</h5>
              <p>
                {data.resolution.choice === null ? (
                  t.exclude
                ) : (
                  <bdi dir="ltr">{data.resolution.choice + 1}</bdi>
                )}
              </p>
              <ChatMessageContent content={data.resolution.explanation} />
            </div>
          )}
          <SourceEvidence sources={data.question.citations} />
          {manage && data.review.state === "requested" && (
            <fieldset disabled={busy} className="space-y-2">
              <label className="block">
                {t.selection}
                <select
                  className="w-full rounded border bg-background p-2"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">—</option>
                  {[0, 1, 2, 3].map((i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                  <option value="exclude">{t.exclude}</option>
                </select>
              </label>
              <label className="block">
                {t.explanation}
                <textarea
                  dir="auto"
                  className="w-full rounded border bg-background p-2"
                  value={explanation}
                  maxLength={2000}
                  onChange={(e) => setExplanation(e.target.value)}
                />
              </label>
              <button className={reviewButton} onClick={() => void apply()}>
                {t.apply}
              </button>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
