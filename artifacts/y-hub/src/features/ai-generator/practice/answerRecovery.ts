import { z } from "zod";
const schema = z
  .object({
    position: z.number().int().min(1).max(100),
    choice: z.number().int().min(0).max(3),
    revision: z.number().int().positive(),
  })
  .strict();
export type PendingChoice = z.infer<typeof schema>;
/** No question, source, answer key or token stored. Account/session-scoped hint only. */
export function answerRecovery(user: string, session: string) {
  const key = `yhub-practice-choice:${user}:${session}`;
  return {
    read(): PendingChoice | null {
      try {
        const value = localStorage.getItem(key);
        return value ? schema.parse(JSON.parse(value)) : null;
      } catch {
        return null;
      }
    },
    write(value: PendingChoice) {
      try {
        localStorage.setItem(key, JSON.stringify(schema.parse(value)));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Storage unavailable; no protected content is cached. */
      }
    },
  };
}
