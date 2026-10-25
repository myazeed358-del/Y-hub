import { z } from "zod";
import { supabase } from "@/utils/supabaseClient";
const student = z.object({
  student_id: z.string(),
  full_name: z.string().nullable(),
  user_number: z.string().regex(/^\d{9}$/),
  course_id: z.string(),
  title: z.string(),
  section_label: z.string().nullable(),
  active_enrollment: z.boolean(),
});
const grant = z.object({
  id: z.string(),
  student_id: z.string(),
  course_id: z.string(),
  engine_id: z.string(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  revocation_reason: z.string().nullable(),
  created_at: z.string(),
  full_name: z.string().nullable(),
  user_number: z.string().regex(/^\d{9}$/),
  title: z.string(),
  section_label: z.string().nullable(),
  state: z.enum([
    "active",
    "manual",
    "withdrawal",
    "assignment",
    "identity",
    "expired",
    "revoked",
    "unavailable",
  ]),
});
export type StudentMatch = z.infer<typeof student>;
export type GrantEntry = z.infer<typeof grant>;
export const grantWorkflows = {
  async search(course: string, search: string, offset = 0) {
    const { data, error } = await supabase.rpc("search_engine_students", {
      p_course: course || null,
      p_search: search.trim(),
      p_offset: offset,
    });
    if (error) throw error;
    return z.object({ total: z.number(), rows: z.array(student) }).parse(data);
  },
  async history(
    course: string,
    studentId: string,
    active: boolean,
    offset = 0,
  ) {
    const { data, error } = await supabase.rpc("engine_grant_history", {
      p_course: course || null,
      p_student: studentId || null,
      p_active: active,
      p_offset: offset,
    });
    if (error) throw error;
    return z.object({ total: z.number(), rows: z.array(grant) }).parse(data);
  },
  async grant(
    course: string,
    studentId: string,
    engines: string[],
    expires: string | null,
  ) {
    const { data, error } = await supabase.rpc("grant_engine_access_batch", {
      p_course: course,
      p_student: studentId,
      p_engines: engines,
      p_expires: expires,
    });
    if (error) throw error;
    const ids = z.array(z.string().uuid()).length(engines.length).parse(data);
    if (!ids.length || new Set(ids).size !== ids.length) {
      throw Error("Grant batch not confirmed");
    }
    return ids;
  },
};
