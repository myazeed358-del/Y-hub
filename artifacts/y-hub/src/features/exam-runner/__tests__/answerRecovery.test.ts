import { beforeEach, expect, it } from 'vitest';
import { readAnswerDrafts, saveAnswerDraft, clearAnswerDrafts } from '../storage/answerRecovery';
const scope = { owner: 'student', exam: 'exam', attempt: 'attempt' };
beforeEach(() => localStorage.clear());
it('roundtrips only answers and never stores timing or scores', () => {
  saveAnswerDraft(localStorage, scope, 'writer', { q: '42' });
  const [draft] = readAnswerDrafts(localStorage, scope);
  expect(draft.answers).toEqual({ q: '42' });
  expect(Object.keys(draft).sort()).toEqual(['version','owner','exam','attempt','writer','updated','answers'].sort());
});
it('does not overwrite another tab and clears only the confirmed scope', () => {
  saveAnswerDraft(localStorage, scope, 'one', { q: '1' });
  saveAnswerDraft(localStorage, scope, 'two', { q: '2' });
  saveAnswerDraft(localStorage, { ...scope, owner: 'other' }, 'one', { q: '3' });
  expect(readAnswerDrafts(localStorage, scope)).toHaveLength(2);
  clearAnswerDrafts(localStorage, scope);
  expect(localStorage.length).toBe(1);
});
it('rejects corrupt data without deleting it or overwriting a previous record', () => {
  saveAnswerDraft(localStorage, scope, 'one', { q: '1' });
  const key = localStorage.key(0)!;
  localStorage.setItem(key, '{broken');
  expect(() => readAnswerDrafts(localStorage, scope)).toThrow();
  expect(() => saveAnswerDraft(localStorage, scope, 'two', { q: '2' })).toThrow();
  expect(localStorage.getItem(key)).toBe('{broken');
});
it('bounds recovery payloads without dropping saved data', () => {
  saveAnswerDraft(localStorage, scope, 'one', { q: 'original' });
  expect(() => saveAnswerDraft(localStorage, scope, 'one', { q: 'x'.repeat(1048576) })).toThrow();
  expect(readAnswerDrafts(localStorage, scope)[0].answers.q).toBe('original');
});
it('rejects records with a forged identity', () => {
  saveAnswerDraft(localStorage, scope, 'one', { q: '1' });
  const key = localStorage.key(0)!;
  const draft = JSON.parse(localStorage.getItem(key)!); draft.owner = 'other';
  localStorage.setItem(key, JSON.stringify(draft));
  expect(() => readAnswerDrafts(localStorage, scope)).toThrow();
});
