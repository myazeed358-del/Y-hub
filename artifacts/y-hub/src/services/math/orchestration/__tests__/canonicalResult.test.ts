import { describe, expect, it, vi } from 'vitest';
import { MathOrchestrator } from '../index';
import { PythonMathAdapter } from '../../python/adapter';

describe('canonical result boundary', () => {
  it('serializes the AST returned by Python rather than reporting placeholder text', async () => {
    const spy = vi.spyOn(PythonMathAdapter.prototype, 'compute').mockResolvedValue({
      success: true, operation_performed: 'derive', result_ast: { type: 'Number', value: '7' },
      result_latex: '7', computation_time_ms: 1, steps: [], warnings: [],
    });
    try {
      const result = await new MathOrchestrator().solve('differentiate x');
      expect(result.type).toBe('symbolic');
      if (result.type === 'symbolic') expect(result.expression).toBe('7');
    } finally {
      spy.mockRestore();
    }
  });
});
