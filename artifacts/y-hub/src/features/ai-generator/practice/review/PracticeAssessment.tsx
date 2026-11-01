import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PracticeSessionError } from "../sessionsRepository";
import { reviewRepository, type Assessment } from "./repository";
import { reviewCopy } from "./copy";
import { ReviewDetailPanel, reviewButton } from "./ReviewDetailPanel";
export function PracticeAssessment({
  sessionId,
  revision,
  onBlocked,
}: {
  sessionId: string;
  revision: number;
  onBlocked?: (kind: "denied" | "conflict") => void;
}) {
  const { language } = useLanguage(),
    t = reviewCopy[language];
  const [data, setData] = useState<Assessment | null>(null),
    [load, setLoad] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<string | null>(null);
  const alive = useRef(true),
    running = useRef(false);
  const reload = () => setLoad((n) => n + 1);
  const report = (e: unknown) => {
    const kind = e instanceof PracticeSessionError ? e.kind : "unavailable";
    setError(
      kind === "denied" || kind === "conflict" || kind === "quota"
        ? t[kind]
        : t.error,
    );
    if (kind === "denied" || kind === "conflict") {
      setData(null);
      setDetail(null);
      onBlocked?.(kind);
    }
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
    reviewRepository
      .assessment(sessionId, controller.signal)
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
  }, [sessionId, revision, load]);
  useEffect(() => {
    const focus = () => {
      if (!running.current) reload();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  async function action(item: Assessment["items"][number], human = false) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      if (human) {
        await reviewRepository.request(item.id!, item.revision!);
      } else {
        const id =
          item.id ?? (await reviewRepository.begin(sessionId, item.position));
        await reviewRepository.recheck(id);
      }
      if (alive.current) reload();
    } catch (e) {
      if (alive.current) {
        report(e);
        if (!(
          e instanceof PracticeSessionError &&
          ["denied", "conflict"].includes(e.kind)
        ))
          reload();
      }
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      aria-label={t.title}
      className="rounded border p-3 space-y-3 min-w-0"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <h4 className="font-semibold">{t.title}</h4>
      <p className="text-sm">{t.note}</p>
      <button
        className={reviewButton}
        disabled={busy}
        onClick={() => {
          setError("");
          reload();
        }}
      >
        {t.reload}
      </button>
      {busy && <p role="status">{t.loading}</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            {t.score}:{" "}
            <bdi dir="ltr">
              {data.graded ? `${data.earned}/${data.graded}` : "—"}
            </bdi>{" "}
            · {t.pending}: <bdi dir="ltr">{data.pending}</bdi> · {t.excluded}:{" "}
            <bdi dir="ltr">{data.excluded}</bdi>
          </p>
          {!data.items.length && <p>{t.empty}</p>}
          {data.items.map((item) => (
            <div key={item.position} className="rounded border p-2 space-y-2">
              <p>
                {t.question} <bdi dir="ltr">{item.position}</bdi> ·{" "}
                {t[item.state]}
              </p>
              {item.outcome && <p>{t[item.outcome]}</p>}
              <div className="flex flex-wrap gap-2">
                {["unverified", "math_verified", "automatic_pending"].includes(
                  item.state,
                ) && (
                  <button
                    className={reviewButton}
                    disabled={busy}
                    onClick={() => void action(item)}
                  >
                    {item.state === "automatic_pending" ? t.retry : t.start}
                  </button>
                )}
                {item.state === "needs_review" && (
                  <button
                    className={reviewButton}
                    disabled={busy}
                    onClick={() => void action(item, true)}
                  >
                    {t.human}
                  </button>
                )}
                {item.id && (
                  <button
                    className={reviewButton}
                    disabled={busy}
                    onClick={() => setDetail(item.id)}
                  >
                    {t.details}
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      {detail && (
        <>
          <button className={reviewButton} onClick={() => setDetail(null)}>
            {t.close}
          </button>
          <ReviewDetailPanel
            key={detail}
            id={detail}
            onChanged={reload}
            onDenied={() => report(new PracticeSessionError("denied"))}
          />
        </>
      )}
    </section>
  );
}
