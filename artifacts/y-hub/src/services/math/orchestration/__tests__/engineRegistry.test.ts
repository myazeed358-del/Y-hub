import { describe, expect, it } from 'vitest';
import { MathEngineRegistry, MathOrchestrator } from '../index';
import type { MathProblemRequest } from '../../types/problem';

const request: MathProblemRequest = {
  rawInput: '2 + 2', operation: 'evaluate',
  expression: { type: 'Number', value: '4' },
  options: { mode: 'AUTO' }, assumptions: [],
};

const result = {
  type: 'numeric' as const, value: 4, tolerance: 0,
  steps: [], warnings: [], conditions: [], engineUsed: 'local_ts' as const,
};

describe('Math engine extension contract', () => {
  it('supports adding an independent implementation without editing orchestration', async () => {
    const registry = new MathEngineRegistry().register({
      id: 'example', supports: input => input.operation === 'evaluate',
      execute: () => result,
    });
    expect(registry.list()).toEqual(['example']);
    expect(await registry.execute(request)).toEqual(result);
    // An unregistered operation preserves historical routing.
    expect(await registry.execute({ ...request, operation: 'integrate' })).toBeNull();
  });

  it('rejects collisions and incomplete success objects', async () => {
    const registry = new MathEngineRegistry().register({ id: 'example', supports: () => true, execute: () => result });
    expect(() => registry.register({ id: 'example', supports: () => true, execute: () => result })).toThrow('Duplicate');
    const invalid = new MathEngineRegistry().register({
      id: 'broken', supports: () => true,
      execute: () => ({ ...result, value: Infinity }),
    });
    await expect(invalid.execute(request)).rejects.toThrow('incomplete result');
  });

  it('exposes the registry through the public orchestrator constructor', () => {
    const registry = new MathEngineRegistry();
    expect(new MathOrchestrator(registry)).toBeInstanceOf(MathOrchestrator);
  });
});
