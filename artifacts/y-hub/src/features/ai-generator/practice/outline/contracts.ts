import { z } from "zod";
const uuid = z.string().uuid();
export const outlineChoiceSchema = z
  .object({
    revision: z.number().int().positive(),
    ids: z.array(uuid).min(1).max(50),
  })
  .strict();
export type OutlineChoice = z.infer<typeof outlineChoiceSchema>;
export const outlineSectionSchema = z
  .object({
    id: uuid,
    kind: z.enum(["chapter", "topic"]),
    title: z.string().trim().min(1).max(160),
    parentId: uuid.nullable(),
    pages: z.array(z.number().int().min(1).max(300)).min(1).max(300),
  })
  .strict();
export const outlineSchema = z.object({
  sourceId: uuid,
  sourceRevision: uuid,
  revision: z.number().int().nonnegative(),
  canManage: z.boolean(),
  stale: z.boolean(),
  sections: z.array(outlineSectionSchema).max(50),
});
export type Outline = z.infer<typeof outlineSchema>;
export type OutlineSection = z.infer<typeof outlineSectionSchema>;
export const outlineCitationSchema = z.object({
  id: uuid,
  kind: z.enum(["chapter", "topic"]),
  title: z.string().min(1).max(160),
});
