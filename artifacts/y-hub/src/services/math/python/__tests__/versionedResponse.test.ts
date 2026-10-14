import { describe, expect, it, vi, afterEach } from 'vitest';
import { isVersionedMathResponse } from '../versionedResponse';
import { PythonMathAdapter } from '../adapter';
import type { MathProblemRequest } from '../../types/problem';

afterEach(() => vi.unstubAllGlobals());

describe('Versioned Python API boundary', () => {
  const request: MathProblemRequest = {
    rawInput: 'x', operation: 'derive',
    expression: { type: 'Symbol', name: 'x' },
    options: { mode: 'AUTO' }, assumptions: [],
  };

  it('rejects the same-URL but different phase API schema', async () => {
    expect(isVersionedMathResponse({ phase: '6', status: 'solved', result: 2 }, 'derive')).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ phase: '6', status: 'solved', result: 2 }),
    }));
    const response = await new PythonMathAdapter().compute(request);
    expect(response.success).toBe(false);
    expect(response.error).toContain('incompatible protocol');
  });

  it('accepts a complete versioned response for the requested operation', () => {
    expect(isVersionedMathResponse({
      success: true, operation_performed: 'derive',
      result_ast: { type: 'Number', value: '2' }, computation_time_ms: 2,
      steps: [], warnings: [],
    }, 'derive')).toBe(true);
    expect(isVersionedMathResponse({
      success: true, operation_performed: 'integrate',
      result_ast: { type: 'Number', value: '2' }, computation_time_ms: 2,
      steps: [], warnings: [],
    }, 'derive')).toBe(false);
  });
});
