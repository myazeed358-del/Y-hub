import { z } from 'zod';
const title = z.string().trim().min(1).max(200);
export const topicSchema = z.object({ id: z.string().uuid(), title }).strict();
export const unitSchema = z.object({ id: z.string().uuid(), title, sections: z.array(topicSchema).max(1000) }).strict();
export const snapshotSchema = z.object({ courseId: z.string().uuid(), revision: z.number().int().nonnegative().safe(), units: z.array(unitSchema).max(100) }).strict();
export type SyllabusUnit = z.infer<typeof unitSchema>;
export type SyllabusSnapshot = z.infer<typeof snapshotSchema>;
export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const next = [...items]; const target = index + delta;
  if (index >= 0 && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
  return next;
}
