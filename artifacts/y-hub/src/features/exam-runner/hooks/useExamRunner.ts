import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { examRunnerRepository } from "../services/examRunnerRepository";
import { formatExamTime } from "../domain/formatExamTime";
import {
  parseAttempt,
  remainingSeconds,
  type ExamAttempt,
  type SubmissionPhase,
} from "../domain/attemptProtocol";
import type { ExamInfo, ExamQuestion, ExamResult } from "../types";

export function useExamRunner() {
  const [, params] = useRoute("/exam/:id");
  const examId = params?.id || "";
  const { user } = useAuth();
  const userId = user?.id;
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<SubmissionPhase>("editing");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const version = useRef(0);
  const ready = useRef(false);
  const clock = useRef<{
    attempt: ExamAttempt;
    received: number;
    requestMs: number;
  } | null>(null);
  const apply = useCallback((raw: unknown, started: number) => {
    const attempt = parseAttempt(raw);
    ++version.current;
    const received = performance.now();
    clock.current = { attempt, received, requestMs: received - started };
    setTimeLeft(
      remainingSeconds(attempt, received, received - started, received),
    );
    setResult(attempt.result);
    setPhase(
      attempt.status === "submitted"
        ? "submitted"
        : attempt.status === "expired"
          ? "expired"
          : "editing",
    );
    setError(null);
    return attempt;
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    busy.current = false;
    ready.current = false;
    clock.current = null;
    ++version.current;
    setExam(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
    setPhase("editing");
    setTimeLeft(0);
    setLoading(true);
    if (!examId || !userId) {
      setLoading(false);
      return;
    }
    let syncing = false;
    async function initialize() {
      try {
        const started = performance.now();
        const attempt = await examRunnerRepository.startAttempt(examId);
        if (generation.current !== current) return;
        const state = apply(attempt, started);
        const info = await examRunnerRepository.getExam(examId);
        if (generation.current !== current) return;
        setExam(info);
        if (state.status === "active") {
          const response = await examRunnerRepository.getQuestions(examId);
          if (generation.current !== current) return;
          if (response.error) throw response.error;
          if (!response.data) throw new Error("Questions unavailable");
          setQuestions(response.data);
          ready.current = true;
        }
      } catch {
        if (generation.current === current) {
          setPhase("failed");
          setError(
            "تعذر تحميل المحاولة. أعد تحميل الصفحة للتحقق من الوصول والوقت المتبقي.",
          );
        }
      } finally {
        if (generation.current === current) setLoading(false);
      }
    }
    async function synchronize() {
      if (
        syncing ||
        busy.current ||
        !clock.current ||
        clock.current.attempt.status !== "active"
      )
        return;
      syncing = true;
      const requestedVersion = version.current;
      try {
        const started = performance.now();
        const attempt = await examRunnerRepository.getAttempt(examId);
        if (
          generation.current === current &&
          !busy.current &&
          version.current === requestedVersion
        )
          apply(attempt, started);
      } catch {
        if (
          generation.current === current &&
          !busy.current &&
          version.current === requestedVersion
        )
          setError(
            "تعذرت مزامنة الوقت. يستمر موعد الخادم؛ تحقق من الاتصال قبل التسليم.",
          );
      } finally {
        syncing = false;
      }
    }
    void initialize();
    const tick = setInterval(() => {
      const value = clock.current;
      if (value)
        setTimeLeft(
          remainingSeconds(
            value.attempt,
            value.received,
            value.requestMs,
            performance.now(),
          ),
        );
    }, 250);
    const sync = setInterval(() => void synchronize(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void synchronize();
    };
    window.addEventListener("focus", synchronize);
    window.addEventListener("online", synchronize);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ++generation.current;
      clearInterval(tick);
      clearInterval(sync);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("online", synchronize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [examId, userId, apply]);

  const handleSubmit = async () => {
    if (
      busy.current ||
      !ready.current ||
      !userId ||
      loading ||
      phase === "submitted" ||
      phase === "expired"
    )
      return;
    busy.current = true;
    const current = generation.current;
    setPhase("submitting");
    setError(null);
    try {
      // Always reconcile first: the last response may have been lost after commit.
      let started = performance.now();
      let attempt = parseAttempt(await examRunnerRepository.getAttempt(examId));
      if (generation.current !== current) return;
      if (attempt.status === "active") {
        started = performance.now();
        attempt = parseAttempt(
          await examRunnerRepository.submitExam(examId, answers),
        );
      }
      if (generation.current !== current) return;
      if (attempt.status !== "submitted" && attempt.status !== "expired")
        throw new Error("Unconfirmed submission");
      apply(attempt, started);
      if (attempt.status === "submitted")
        toast.success("تم تسليم الاختبار بنجاح");
    } catch {
      if (generation.current === current) {
        setPhase("failed");
        setError(
          "لم يُؤكّد حفظ النتيجة. إجاباتك ما زالت هنا؛ تحقق من الاتصال والجلسة ثم أعد المحاولة.",
        );
        toast.error("لم يتم تأكيد التسليم");
      }
    } finally {
      if (generation.current === current) busy.current = false;
    }
  };
  return {
    exam,
    questions,
    loading,
    answers,
    setAnswers,
    timeLeft,
    phase,
    error,
    isSubmitted: phase === "submitted",
    result,
    handleSubmit,
    formatTime: formatExamTime,
  };
}
