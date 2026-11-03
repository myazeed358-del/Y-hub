import { z } from "zod";
import { performanceRpc, summarySchema } from "./repository";
import { PracticeSessionError } from "../sessionsRepository";
export type PerformanceDimension = "chapter" | "topic";
const count = z.number().int().nonnegative();
const attribution = z.object({
  sourceId: z.string().uuid(),
  sourceRevision: z.string().uuid(),
  outlineRevision: z.number().int().positive(),
  sectionId: z.string().uuid(),
  title: z.string().min(1).max(160),
  sourceTitle: z.string(),
});
const schema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["chapter", "topic"]),
  offset: count,
  groupCount: count,
  hasMore: z.boolean(),
  weights: z
    .object({
      practice: z.number().int().min(0).max(100),
      exam: z.number().int().min(0).max(100),
      revision: count,
    })
    .refine((w) => w.practice + w.exam === 100),
  groups: z
    .array(
      z.object({ attribution: attribution.nullable(), summary: summarySchema }),
    )
    .max(20),
});
export type TopicPerformance = z.infer<typeof schema>;
export const topicRepository = {
  async read(
    courseId: string,
    kind: PerformanceDimension,
    offset: number,
    signal: AbortSignal,
  ) {
    const data = schema.parse(
      await performanceRpc(
        "read_ai_practice_topic_performance",
        { p_course: courseId, p_kind: kind, p_offset: offset },
        signal,
      ),
    );
    if (
      data.courseId !== courseId ||
      data.kind !== kind ||
      data.offset !== offset
    )
      throw new PracticeSessionError("unavailable");
    return data;
  },
};
