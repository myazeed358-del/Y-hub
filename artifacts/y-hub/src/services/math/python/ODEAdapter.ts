import type { ODERequest, ODEResult, SystemODERequest, SystemODEResult } from '../types/ode';
import { PHASE_MATH_ENDPOINT, postPhaseMath } from './phaseClient';
import { mapExactODE, mapExactSystemODE } from './odeResponseMapping';

/** Python acceleration is optional; unsupported responses use the native TS solver. */
export class ODEAdapter {
  constructor(private readonly endpoint: string = PHASE_MATH_ENDPOINT) {}

  public async executePythonODE(req: ODERequest): Promise<ODEResult | null> {
    if (req.mode === 'numerical' || req.mode === 'qualitative') return null;
    const data = await postPhaseMath(this.endpoint, {
      operation: 'solve_ode', phase: '7', mode: 'auto',
      input: {
        equation: req.equation,
        // The Python AST bridge requires Symbol nodes, not raw variable names.
        independentVariable: { type: 'Symbol', name: req.independentVariable },
        dependentVariable: { type: 'Symbol', name: req.dependentVariable },
      },
    }, 10000);
    if (!data) return null;
    if (data.status === 'solved') return mapExactODE(req, data);
    // Do not skip the TS fallback when Python could not establish a solution.
    return null;
  }

  public async executePythonSystemODE(req: SystemODERequest): Promise<SystemODEResult | null> {
    if (req.mode === 'numerical' || req.mode === 'qualitative') return null;
    const data = await postPhaseMath(this.endpoint, {
      operation: 'solve_system_ode', phase: '9', mode: 'auto',
      input: {
        equations: req.equations,
        independentVariable: { type: 'Symbol', name: req.independentVariable },
        dependentVariables: req.dependentVariables.map(name => ({ type: 'Symbol', name })),
      },
    }, 15000);
    if (!data) return null;
    return data.status === 'solved' ? mapExactSystemODE(req, data) : null;
  }
}
