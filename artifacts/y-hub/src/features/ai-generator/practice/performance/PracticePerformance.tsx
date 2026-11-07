import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PracticeSessionError } from "../sessionsRepository";
import { performanceRepository, type Performance } from "./repository";
import { performanceCopy } from "./copy";
import { PerformanceSummary } from "./PerformanceSummary";
import { WeightEditor } from "./WeightEditor";
import { TopicPerformance } from "./TopicPerformance";
import { topicCopy } from "./topicCopy";
export function PracticePerformance({ courseId }: { courseId: string }) {
  const { language } = useLanguage(),
    t = performanceCopy[language];
  const [open, setOpen] = useState(false);
  return (
    <section
      className="min-w-0 border-t pt-3"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <button
        className="rounded border px-3 py-2 text-sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t.title}
      </button>
      {open && <PerformancePanel key={courseId} courseId={courseId} />}
    </section>
  );
}
function PerformancePanel({ courseId }: { courseId: string }) {
  const { language } = useLanguage(),
    t = performanceCopy[language];
  const [data, setData] = useState<Performance | null>(null),
    [offset, setOffset] = useState(0),
    [epoch, setEpoch] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [dimension, setDimension] = useState<"unit" | "chapter" | "topic">(
    "unit",
  );
  const topics = topicCopy[language];
  const [draft, setDraft] = useState<Performance["weights"] | null>(null);
  const request = useRef<AbortController | null>(null);
  const reload = () => {
    request.current?.abort();
    setData(null);
    setEpoch((n) => n + 1);
  };
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") reload();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setData(null);
    performanceRepository
      .read(courseId, offset, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          const denied =
            e instanceof PracticeSessionError && e.kind === "denied";
          setError(denied ? t.denied : t.error);
          if (denied) setDraft(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [courseId, offset, epoch]);
  const denied = () => {
    request.current?.abort();
    setData(null);
    setDraft(null);
    setError(t.denied);
  };
  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  return (
    <div className="mt-3 min-w-0 space-y-3" aria-label={t.title}>
      <p>{t.note}</p>
      <p className="text-sm text-muted-foreground">{t.scope}</p>
      <p className="text-sm">{t.weightHelp}</p>
      <button className={button} disabled={loading} onClick={reload}>
        {t.reload}
      </button>
      {loading && <p role="status">{t.loading}</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {t.weights}: {t.practice}{" "}
            <bdi dir="ltr">{data.weights.practice}%</bdi> · {t.exam}{" "}
            <bdi dir="ltr">{data.weights.exam}%</bdi>
          </p>
          {data.canManage && (
            <WeightEditor
              courseId={courseId}
              weights={data.weights}
              draft={draft}
              onDraft={setDraft}
              onSaved={() => {
                setDraft(null);
                reload();
              }}
              onDenied={denied}
            />
          )}
          <PerformanceSummary summary={data.summary} />
          {data.unavailableSessions > 0 && (
            <p>
              {t.unavailable}: <bdi dir="ltr">{data.unavailableSessions}</bdi>
            </p>
          )}
          <div
            role="group"
            aria-label={topics.dimension}
            className="flex flex-wrap gap-2"
          >
            {(["unit", "chapter", "topic"] as const).map((kind) => (
              <button
                key={kind}
                className={button}
                aria-pressed={dimension === kind}
                onClick={() => setDimension(kind)}
              >
                {topics[kind]}
              </button>
            ))}
          </div>
          {dimension !== "unit" ? (
            <TopicPerformance
              key={courseId + dimension}
              courseId={courseId}
              kind={dimension}
            />
          ) : (
            <>
              <h4 className="font-semibold">
                {t.units} (<bdi dir="ltr">{data.unitCount}</bdi>)
              </h4>
              {!data.units.length && <p>{t.none}</p>}
              {data.units.map((u) => (
                <article
                  key={u.unitId ?? "unclassified"}
                  className="min-w-0 space-y-2 rounded border p-3"
                >
                  <h5 className="break-words font-medium" dir="auto">
                    {u.title ?? t.unmapped}
                  </h5>
                  <PerformanceSummary summary={u.summary} />
                </article>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  {t.previous}
                </button>
                <button
                  className={button}
                  disabled={!data.hasMore}
                  onClick={() => setOffset(offset + 20)}
                >
                  {t.next}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
