import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalAST } from '../../types/ast';
import type { ODERequest, SystemODERequest } from '../../types/ode';
import { ODEAdapter } from '../ODEAdapter';

const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
const equation: CanonicalAST = { type: 'Equation', lhs: sym('y_prime'), rhs: sym('y') };
const single: ODERequest = {
  equation, independentVariable: 'x', dependentVariable: 'y',
  derivativeVariable: 'y_prime', mode: 'symbolic',
};
const system: SystemODERequest = {
  isSystem: true, equations: [equation, equation],
  independentVariable: 't', dependentVariables: ['x', 'y'],
  derivativeVariables: ['x_prime', 'y_prime'], mode: 'symbolic',
};
const rhs = (value: string): CanonicalAST => ({ type: 'Number', value });
let latestPayload: Record<string, any> = {};
const mock = (phase: string, operation: string, result: unknown) => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: unknown, options: RequestInit) => {
    latestPayload = JSON.parse(String(options.body));
    return { ok: true, json: async () => ({ phase, operation, status: 'solved', result, steps: [] }) };
  }));
};
afterEach(() => vi.unstubAllGlobals());

describe('ODE Python mapping boundary', () => {
  it('sends variable AST nodes and converts RHS AST into an explicit equation', async () => {
    mock('7', 'solve_ode', [rhs('2')]);
    const result = await new ODEAdapter().executePythonODE(single);
    expect(latestPayload.mode).toBe('auto');
    expect(latestPayload.input.independentVariable).toEqual(sym('x'));
    expect(result?.solutions[0].equation).toEqual({
      type: 'Equation', lhs: sym('y'), rhs: rhs('2'),
    });
  });

  it('maps system RHS values by dependent variable', async () => {
    mock('9', 'solve_system_ode', [rhs('1'), rhs('2')]);
    const result = await new ODEAdapter().executePythonSystemODE(system);
    expect(latestPayload.input.dependentVariables).toEqual([sym('x'), sym('y')]);
    expect(result?.solutions[0].equations).toEqual([
      { type: 'Equation', lhs: sym('x'), rhs: rhs('1') },
      { type: 'Equation', lhs: sym('y'), rhs: rhs('2') },
    ]);
  });

  it('rejects incomplete systems and malformed AST nodes', async () => {
    mock('9', 'solve_system_ode', [rhs('1')]);
    expect(await new ODEAdapter().executePythonSystemODE(system)).toBeNull();
    mock('7', 'solve_ode', [{ type: 'NotAnAST', value: 2 }]);
    expect(await new ODEAdapter().executePythonODE(single)).toBeNull();
  });

  it('never sends numerical/qualitative requests to the symbolic Python route', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await new ODEAdapter().executePythonODE({ ...single, mode: 'numerical' })).toBeNull();
    expect(await new ODEAdapter().executePythonSystemODE({ ...system, mode: 'qualitative' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
