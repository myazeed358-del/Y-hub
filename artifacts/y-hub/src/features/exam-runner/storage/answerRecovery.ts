import { z } from 'zod';
import type { ExamAnswers } from '../types';

const draftSchema = z.object({
  version: z.literal(1), owner: z.string(), exam: z.string(), attempt: z.string(),
  writer: z.string(), updated: z.number().finite(),
  answers: z.record(z.string(), z.string()),
}).strict();
export type AnswerDraft = z.infer<typeof draftSchema>;
export type DraftScope = Pick<AnswerDraft, 'owner' | 'exam' | 'attempt'>;
const prefix = (scope: DraftScope) => `yhub:exam-draft:v1:${[scope.owner, scope.exam, scope.attempt].map(encodeURIComponent).join(':')}:`;
const limit = 1048576;

/** Each mounted editor has a separate journal slot: another tab cannot overwrite it.
 * Never store a score, answer key or client-authoritative deadline in recovery. */
export function readAnswerDrafts(storage: Storage, scope: DraftScope): AnswerDraft[] {
  const drafts: AnswerDraft[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix(scope))) continue;
    const raw = storage.getItem(key);
    if (!raw || raw.length > limit) throw Error('Invalid recovery record');
    const draft = draftSchema.parse(JSON.parse(raw));
    if (draft.owner !== scope.owner || draft.exam !== scope.exam || draft.attempt !== scope.attempt || key !== prefix(scope) + draft.writer)
      throw Error('Recovery scope mismatch');
    drafts.push(draft);
  }
  return drafts.sort((a, b) => b.updated - a.updated || a.writer.localeCompare(b.writer));
}
export function saveAnswerDraft(storage: Storage, scope: DraftScope, writer: string, answers: ExamAnswers) {
  const key = prefix(scope) + writer;
  // Bounded journal without silently evicting another editor's unsaved answers.
  if (!storage.getItem(key) && readAnswerDrafts(storage, scope).length >= 64) throw Error('Recovery journal full');
  const draft = draftSchema.parse({ version: 1, ...scope, writer, updated: Date.now(), answers });
  const raw = JSON.stringify(draft);
  if (raw.length > limit) throw Error('Recovery too large');
  storage.setItem(key, raw);
}
export function clearAnswerDrafts(storage: Storage, scope: DraftScope) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix(scope))) keys.push(key);
  }
  keys.forEach(key => storage.removeItem(key));
}
