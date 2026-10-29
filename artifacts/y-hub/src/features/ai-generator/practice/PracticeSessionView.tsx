import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { ChatMessageContent } from "../ai-chat/ChatMessageContent";
import { SourceEvidence } from "../knowledge/SourceEvidence";
import { answerRecovery, type PendingChoice } from "./answerRecovery";
import {
  sessionsRepository,
  PracticeSessionError,
  type PracticeSession,
} from "./sessionsRepository";
import { sessionCopy } from "./sessionCopy";
const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
export function PracticeSessionView({
  id,
  onDirty,
}: {
  id: string;
  onDirty: (dirty: boolean) => void;
}) {
  const { user } = useAuth(),
    { language } = useLanguage(),
    t = sessionCopy[language];
  const recovery = useRef(answerRecovery(user!.id, id));
  const [session, setSession] = useState<PracticeSession | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const [pending, setPending] = useState<{
    value: PendingChoice;
    auto: boolean;
  } | null>(null);
  const alive = useRef(true),
    running = useRef(false),
    request = useRef<AbortController | null>(null);
  function report(e: unknown) {
    const kind = e instanceof PracticeSessionError ? e.kind : "unavailable";
    setError(t[kind]);
    if (kind === "conflict") setSession(null);
    if (kind === "denied") {
      setSession(null);
      setPending(null);
      recovery.current.clear();
    }
  }
  async function load() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const data = await sessionsRepository.read(id, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setSession(data);
      const saved = recovery.current.read();
      if (saved) {
        const question = data.questions.find(
          (q) => q.position === saved.position,
        );
        if (
          !question ||
          data.submittedAt ||
          question.answered ||
          question.choice === saved.choice
        ) {
          recovery.current.clear();
          setPending(null);
        } else setPending({ value: saved, auto: false });
      }
    } catch (e) {
      if (alive.current && !controller.signal.aborted) report(e);
    } finally {
      if (request.current === controller) {
        running.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      request.current?.abort();
      running.current = false;
      window.removeEventListener("focus", focus);
    };
  }, [id]);
  useEffect(() => {
    onDirty(!!pending);
    const warn = (e: BeforeUnloadEvent) => {
      if (pending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending, onDirty]);
  async function action(run: () => Promise<unknown>, clear = false) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
      if (!alive.current) return;
      if (clear) {
        recovery.current.clear();
        setPending(null);
      }
      const data = await sessionsRepository.read(id);
      if (alive.current) setSession(data);
    } catch (e) {
      if (alive.current) report(e);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const persist = (explicit: boolean) => {
    if (!session || !pending) return;
    const value = pending.value;
    setPending({ value, auto: false });
    void action(
      () =>
        sessionsRepository.save(
          {
            ...session,
            revision: explicit ? session.revision : value.revision,
          },
          value.position,
          value.choice,
        ),
      true,
    );
  };
  useEffect(() => {
    if (!pending?.auto || busy) return;
    const timer = setTimeout(() => persist(false), 750);
    return () => clearTimeout(timer);
  }, [pending, busy]);
  function choose(position: number, choice: number) {
    if (!session) return;
    const value = { position, choice, revision: session.revision };
    setStorageFailed(!recovery.current.write(value));
    setPending({ value, auto: true });
    setError("");
  }
  return (
    <div className="space-y-3 min-w-0">
      <button className={button} disabled={busy} onClick={() => void load()}>
        {t.reload}
      </button>
      {busy && <p role="status">{t.working}</p>}
      {error && <p role="alert">{error}</p>}
      {storageFailed && pending && (
        <p role="alert">
          {language === "ar"
            ? "الاستعادة المحلية غير متاحة؛ أبق الصفحة مفتوحة حتى الحفظ."
            : "Local recovery unavailable; keep this page open until saved."}
        </p>
      )}
      {pending && (
        <div role="status">
          <p>{pending.auto ? t.dirty : t.review}</p>
          <button
            className={button}
            disabled={busy}
            onClick={() => persist(true)}
          >
            {t.save}
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              recovery.current.clear();
              setPending(null);
            }}
          >
            {t.clear}
          </button>
        </div>
      )}
      {session && (
        <>
          <p>{t.advisory}</p>
          <p>
            {t[session.mode]} · {t[session.difficulty]} ·{" "}
            <bdi dir="ltr">
              {session.questions.length}/{session.target}
            </bdi>{" "}
            · {session.submittedAt ? t.completed : t.pending}
          </p>
          {!pending && <p role="status">{t.saved}</p>}
          {session.questions.map((q) => (
            <article
              key={q.position}
              className="rounded border p-3 min-w-0 space-y-2"
            >
              <h4>
                <bdi dir="ltr">{q.position}.</bdi>
              </h4>
              <ChatMessageContent content={q.prompt} />
              {pending?.value.position === q.position && (
                <p className="text-xs">
                  {language === "ar"
                    ? "الخيار المحفوظ على الخادم"
                    : "Server-saved choice"}
                  :{" "}
                  <bdi dir="ltr">{q.choice === null ? "—" : q.choice + 1}</bdi>
                </p>
              )}
              <fieldset
                disabled={
                  busy ||
                  !!session.submittedAt ||
                  q.answered ||
                  !!(pending && pending.value.position !== q.position)
                }
                className="space-y-2"
              >
                {q.options.map((option, i) => (
                  <label key={i} className="flex gap-2 items-start min-w-0">
                    <input
                      type="radio"
                      name={`${id}:${q.position}`}
                      aria-label={`${q.position}: ${i + 1}`}
                      checked={
                        (pending?.value.position === q.position
                          ? pending.value.choice
                          : q.choice) === i
                      }
                      onChange={() => choose(q.position, i)}
                    />
                    <div className="min-w-0">
                      <ChatMessageContent content={option} />
                    </div>
                  </label>
                ))}
              </fieldset>
              {!session.submittedAt &&
                !q.answered &&
                session.mode === "practice" && (
                  <button
                    className={button}
                    disabled={busy || !!pending || q.choice === null}
                    onClick={() =>
                      void action(() =>
                        sessionsRepository.save(
                          session,
                          q.position,
                          q.choice!,
                          true,
                        ),
                      )
                    }
                  >
                    {t.answer}
                  </button>
                )}
              {q.feedback && (
                <div className="rounded bg-muted p-3 min-w-0">
                  <p>
                    {q.feedback.matchesSuggestion === null
                      ? t.unanswered
                      : q.feedback.matchesSuggestion
                        ? t.match
                        : t.different}
                  </p>
                  <p>
                    {t.suggestion}:{" "}
                    <bdi dir="ltr">{q.feedback.suggestedChoice + 1}</bdi>
                  </p>
                  <ChatMessageContent content={q.feedback.explanation} />
                  <SourceEvidence sources={q.feedback.citations} />
                </div>
              )}
            </article>
          ))}
          {!session.submittedAt &&
            session.questions.length < session.target && (
              <button
                className={button}
                disabled={busy || !!pending}
                onClick={() =>
                  void action(() =>
                    sessionsRepository.generate(
                      id,
                      session.questions.length + 1,
                    ),
                  )
                }
              >
                {t.generate}
              </button>
            )}
          {!session.submittedAt &&
            session.questions.length === session.target && (
              <button
                className={button}
                disabled={busy || !!pending}
                onClick={() => {
                  if (window.confirm(t.finish))
                    void action(() => sessionsRepository.submit(session));
                }}
              >
                {t.submit}
              </button>
            )}
        </>
      )}
    </div>
  );
}
