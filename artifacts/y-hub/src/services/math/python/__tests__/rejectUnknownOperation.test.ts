import { describe, expect, it } from 'vitest';
import { PythonMathAdapter } from '../adapter';

describe('operation mapping', () => {
  it('never silently turns an unknown operation into evaluate', async () => {
    const adapter = new PythonMathAdapter();
    await expect(adapter.compute({
      operation: 'not_a_math_operation', rawInput: 'x',
      expression: { type: 'Symbol', name: 'x' }, options: {mode: 'AUTO'}, assumptions: [],
    } as any)).rejects.toThrow('Unsupported Python math operation');
  });
});
