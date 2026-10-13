export interface ExamInfo {
  course_id: string;
  title: string;
  time_limit_minutes: number;
}

export interface ExamQuestion {
  id: string;
  content: string;
  type: string;
  options?: string[];
}

export interface ExamResult {
  score: number;
  total_score: number;
}

export type ExamAnswers = Record<string, string>;
