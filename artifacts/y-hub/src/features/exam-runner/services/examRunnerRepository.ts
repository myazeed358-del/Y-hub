import { supabase } from "@/utils/supabaseClient";
import { parseAttempt } from "../domain/attemptProtocol";
import type { ExamAnswers, ExamInfo, ExamQuestion, ExamResult } from "../types";

export const examRunnerRepository = {
  async previousResult(examId: string, studentId: string) {
    const { data, error } = await supabase
      .from("student_results")
      .select("*")
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) throw error;
    return data as ExamResult | null;
  },

  async getExam(examId: string) {
    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .eq("id", examId)
      .single();

    if (error) throw error;
    return data as ExamInfo | null;
  },

  async getQuestions(examId: string) {
    const { data, error } = await supabase.rpc("get_exam_questions", {
      p_exam_id: examId,
    });

    return {
      data: data as ExamQuestion[] | null,
      error,
    };
  },

  async startAttempt(examId: string) {
    const { data, error } = await supabase.rpc("start_exam_attempt", {
      p_exam_id: examId,
    });
    if (error) throw error;
    return parseAttempt(data);
  },

  async getAttempt(examId: string) {
    const { data, error } = await supabase.rpc("get_exam_attempt", {
      p_exam_id: examId,
    });
    if (error) throw error;
    return parseAttempt(data);
  },

  async submitExam(examId: string, answers: ExamAnswers) {
    const { data, error } = await supabase.rpc("submit_exam", {
      p_exam_id: examId,
      p_answers: answers,
    });
    if (error) throw error;
    return parseAttempt(data);
  },
};
