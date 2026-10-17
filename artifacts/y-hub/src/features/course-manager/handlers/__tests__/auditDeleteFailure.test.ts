import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandleDeleteExam } from '../createHandleDeleteExam';
import { createHandleDeleteQuestion } from '../createHandleDeleteQuestion';
const { eq, select, from, errorToast } = vi.hoisted(() => ({ eq: vi.fn(), select: vi.fn(), from: vi.fn(), errorToast: vi.fn() }));
vi.mock('@/utils/supabaseClient', () => ({ supabase: { from } }));
vi.mock('sonner', () => ({ toast: { error: errorToast } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  from.mockReturnValue({ delete: () => ({ eq }) });
  eq.mockReturnValue({ select });
  select.mockImplementation(async () => ({ data: [{ id: eq.mock.lastCall?.[1] }], error: null }));
});
afterEach(() => vi.unstubAllGlobals());

describe.each(['exam', 'question'] as const)('%s deletion database outcome', kind => {
  function setup() {
    const reload = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn();
    const handler = kind === 'exam'
      ? createHandleDeleteExam({ selectedExam: { id: 'exam-id' }, setSelectedExam: clear, loadData: reload })
      : createHandleDeleteQuestion({ selectedExam: { id: 'exam-id' }, loadQuestions: reload });
    return { handler, reload, clear, id: kind === 'exam' ? 'exam-id' : 'question-id' };
  }
  it('surfaces a rolled-back audit failure without clearing or reloading as success', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'private SQL audit failure detail', code: 'P0001' } });
    const { handler, reload, clear, id } = setup();
    await handler(id);
    expect(errorToast).toHaveBeenCalledOnce();
    expect(errorToast.mock.calls[0][0]).not.toContain('private SQL');
    expect(reload).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
  // PostgREST deliberately makes these cases indistinguishable to the client.
  it.each(['RLS hides the row', 'row does not exist'])('does not report deletion when %s', async () => {
    select.mockResolvedValue({ data: [], error: null });
    const { handler, reload, clear, id } = setup();
    await handler(id);
    expect(select).toHaveBeenCalledWith('id');
    expect(errorToast).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
  it('preserves the existing successful deletion behavior', async () => {
    const { handler, reload, clear, id } = setup();
    await handler(id);
    expect(from).toHaveBeenCalledWith(kind === 'exam' ? 'exams' : 'questions');
    expect(eq).toHaveBeenCalledWith('id', id);
    expect(select).toHaveBeenCalledWith('id');
    expect(reload).toHaveBeenCalledOnce();
    if (kind === 'exam') expect(clear).toHaveBeenCalledWith(null);
    expect(errorToast).not.toHaveBeenCalled();
  });
  it('does not write when deletion is cancelled', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    const { handler, reload, id } = setup();
    await handler(id);
    expect(from).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
