import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PracticeSessionError } from "../sessionsRepository";
import {
  topicRepository,
  type PerformanceDimension,
  type TopicPerformance as Report,
} from "./topicRepository";
import { topicCopy } from "./topicCopy";
import { performanceCopy } from "./copy";
import { PerformanceSummary } from "./PerformanceSummary";
export function TopicPerformance({
  courseId,
  kind,
}: {
  courseId: string;
  kind: PerformanceDimension;
}) {
  const { language } = useLanguage(),
    t = topicCopy[language],
    p = performanceCopy[language];
  const [data, setData] = useState<Report | null>(null),
    [offset, setOffset] = useState(0),
    [epoch, setEpoch] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const change = (next: number) => {
    request.current?.abort();
    setData(null);
    setOffset(next);
    setEpoch((n) => n + 1);
  };
  useEffect(() => {
    const c = new AbortController();
    request.current = c;
    setData(null);
    setLoading(true);
    setError("");
    topicRepository
      .read(courseId, kind, offset, c.signal)
      .then((value) => {
        if (!c.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            e instanceof PracticeSessionError && e.kind === "denied"
              ? p.denied
              : p.error,
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [courseId, kind, offset, epoch]);
  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section className="min-w-0 space-y-3" aria-label={t[kind]}>
      <p className="text-sm text-muted-foreground">{t.note}</p>
      <button
        className={button}
        disabled={loading}
        onClick={() => change(offset)}
      >
        {t.refresh}
      </button>
      {loading && <p role="status">{p.loading}</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {p.weights}: {p.practice}{" "}
            <bdi dir="ltr">{data.weights.practice}%</bdi> · {p.exam}{" "}
            <bdi dir="ltr">{data.weights.exam}%</bdi>
          </p>
          <h4 className="font-semibold">
            {t[kind]} (<bdi dir="ltr">{data.groupCount}</bdi>)
          </h4>
          {!data.groups.length && <p>{p.none}</p>}
          {data.groups.map((g) => (
            <article
              key={
                g.attribution
                  ? `${g.attribution.sourceId}/${g.attribution.sourceRevision}/${g.attribution.outlineRevision}/${g.attribution.sectionId}`
                  : "unclassified"
              }
              className="min-w-0 space-y-2 rounded border p-3"
            >
              <h5 className="break-words font-medium" dir="auto">
                {g.attribution?.title ?? t.unmapped}
              </h5>
              {g.attribution && (
                <p className="break-words text-sm">
                  {t.source}: <bdi dir="auto">{g.attribution.sourceTitle}</bdi>
                </p>
              )}
              <PerformanceSummary summary={g.summary} />
            </article>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={offset === 0}
              onClick={() => change(Math.max(0, offset - 20))}
            >
              {t.previous}
            </button>
            <button
              className={button}
              disabled={!data.hasMore}
              onClick={() => change(offset + 20)}
            >
              {t.next}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
