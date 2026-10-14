import { describe, expect, it, vi } from 'vitest';
import { DomainEngineCatalog, createDomainEnginePort } from '../enginePort';
import {
  standardMathEnginePorts, inequalityPort, functionAnalysisPort,
  linearAlgebraPort, equationPort, integrationPort, numericRootPort,
} from '../defaultPorts';
import type { CanonicalAST } from '../../types/ast';

const n = (value: number): CanonicalAST => ({ type: 'Number', value: String(value) });
const x: CanonicalAST = { type: 'Symbol', name: 'x' };

/** These tests exercise the public ports, not another engine's implementation internals. */
describe('independent math engine public ports', () => {
  it('exposes distinct entry points for all 11 primary math domains', () => {
    expect(standardMathEnginePorts).toHaveLength(11);
    expect(new Set(standardMathEnginePorts.map(port => port.id)).size).toBe(11);
  });

  it('adds a new engine with no change to registry code', async () => {
    const port = createDomainEnginePort('new-domain', (v): v is number => typeof v === 'number', n => n ** 2,
      (v): v is number => typeof v === 'number' && Number.isFinite(v));
    const registry = new DomainEngineCatalog().register(port);
    expect(await registry.run('new-domain', 4)).toBe(16);
    await expect(registry.run('new-domain', '4')).rejects.toThrow('Invalid input');
    expect(() => registry.register(port)).toThrow('Duplicate');
  });

  it('rejects a complete-looking transport success with missing result', async () => {
    const bad = createDomainEnginePort<number, { status: string; value: number }>('broken', (v): v is number => typeof v === 'number',
      () => ({ status: 'solved' } as any),
      (v): v is { status: string; value: number } =>
        !!v && typeof v === 'object' && 'value' in v && typeof v.value === 'number');
    await expect(bad.execute(1)).rejects.toThrow('Incomplete output');
  });

  it('preserves interval semantics through the inequality port', async () => {
    const result = await inequalityPort.execute({ expression: {
      type: 'Inequality', operator: '>', lhs: x, rhs: n(0),
    }, variable: 'x' });
    expect(result.kind).toBe('solution_set');
    if (result.kind === 'solution_set') expect(result.solution.intervals).toHaveLength(1);
  });

  it('returns a complete derivative analysis and domain', async () => {
    const result = await functionAnalysisPort.execute({
      expression: { type: 'Operator', operator: '^', args: [x, n(2)] }, variable: 'x', mode: 'real',
    });
    expect(result.domain.intervals.length).toBeGreaterThan(0);
    expect(result.graphData?.behaviorSegments.length ?? 0).toBeGreaterThan(0);
  });

  it('retains the LA fallback while refusing incomplete success shells', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    try {
      const result = await linearAlgebraPort.execute({operation: 'determinant', mode: 'exact', matrices: [
        [[n(1), n(2)], [n(3), n(4)]],
      ]});
      expect(result.status).toBe('solved');
      expect(result.resultScalar).toEqual(n(-2));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps equation candidate generation and result verification separate', async () => {
    const result = await equationPort.execute({
      equation: { type: 'Equation', lhs: x, rhs: n(2) }, variable: 'x',
    });
    expect(result.finalSolutions.length).toBeGreaterThan(0);
  });

  it('returns a real antiderivative instead of a success-only envelope', async () => {
    const result = await integrationPort.execute({ integrand: x, expression: x, variable: 'x' });
    expect(result.status).toBe('exact_symbolic');
    expect(result.antiderivative).toBeDefined();
  });

  it('allows a bounded numerical root through the same contract shape', async () => {
    const result = await numericRootPort.execute({
      expression: { type: 'Operator', operator: '-', args: [x, n(2)] },
      variable: 'x', initialGuess: 0,
    });
    expect(result?.root).toBeCloseTo(2, 7);
  });
});
