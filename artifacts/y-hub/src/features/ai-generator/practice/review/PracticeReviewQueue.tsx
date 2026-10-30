import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { profileName } from "@/shared/identity/profileName";
import { PracticeSessionError } from "../sessionsRepository";
import { reviewRepository, type ReviewSummary } from "./repository";
import { reviewCopy } from "./copy";
import { ReviewDetailPanel, reviewButton } from "./ReviewDetailPanel";
export function PracticeReviewQueue({ courseId }: { courseId: string }) {
  const { language } = useLanguage(),
    t = reviewCopy[language];
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<ReviewSummary[]>([]),
    [offset, setOffset] = useState(0),
    [resolved, setResolved] = useState(false),
    [load, setLoad] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<string | null>(null);
  const active = useRef(false);
  const reload = () => setLoad((n) => n + 1);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    active.current = true;
    setBusy(true);
    setError("");
    reviewRepository
      .queue(courseId, resolved, offset, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRows([]);
          const kind =
            e instanceof PracticeSessionError ? e.kind : "unavailable";
          setError(kind === "denied" ? t.denied : t.error);
          if (kind === "denied") setDetail(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
          active.current = false;
        }
      });
    return () => controller.abort();
  }, [open, courseId, resolved, offset, load]);
  useEffect(() => {
    const focus = () => {
      if (!active.current) reload();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  return (
    <div
      className="border-t pt-3 space-y-3 min-w-0"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <button
        className={reviewButton}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t.queue}
      </button>
      {open && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              className={reviewButton}
              disabled={busy}
              onClick={() => {
                setResolved(false);
                setOffset(0);
                setDetail(null);
              }}
            >
              {t.open}
            </button>
            <button
              className={reviewButton}
              disabled={busy}
              onClick={() => {
                setResolved(true);
                setOffset(0);
                setDetail(null);
              }}
            >
              {t.closed}
            </button>
            <button className={reviewButton} disabled={busy} onClick={reload}>
              {t.reload}
            </button>
          </div>
          {busy && <p role="status">{t.loading}</p>}
          {error && <p role="alert">{error}</p>}
          {!busy && !rows.length && <p>{t.noRequests}</p>}
          {rows.map((row) => (
            <button
              className={`${reviewButton} block w-full text-start`}
              key={row.id}
              disabled={busy}
              onClick={() => setDetail(row.id)}
            >
              {profileName(row, language, "—")} ·{" "}
              <bdi dir="ltr">{row.user_number}</bdi> · {t.question}{" "}
              <bdi dir="ltr">{row.position}</bdi>
            </button>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              className={reviewButton}
              disabled={busy || offset === 0}
              onClick={() => setOffset((n) => Math.max(0, n - 20))}
            >
              {t.previous}
            </button>
            <button
              className={reviewButton}
              disabled={busy || rows.length < 20}
              onClick={() => setOffset((n) => n + 20)}
            >
              {t.next}
            </button>
          </div>
          {detail && (
            <>
              <button className={reviewButton} onClick={() => setDetail(null)}>
                {t.close}
              </button>
              <ReviewDetailPanel
                key={detail}
                id={detail}
                manage
                onChanged={reload}
                onDenied={() => {
                  setRows([]);
                  setDetail(null);
                  setError(t.denied);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
