import { ODERequest, ODEResult, SystemODERequest, SystemODEResult } from '../types/ode';

export class ODEAdapter {
    private endpoint: string;

    constructor(endpoint: string = 'http://localhost:8000/api/v1/math/compute') {
        this.endpoint = endpoint;
    }

    public async executePythonODE(req: ODERequest): Promise<ODEResult | null> {
        try {
            const payload = {
                operation: 'solve_ode',
                phase: '7',
                mode: req.mode || 'auto',
                input: {
                    equation: req.equation,
                    independentVariable: req.independentVariable,
                    dependentVariable: req.dependentVariable
                }
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) return null;

            const data = await res.json();
            
            if (data.status === 'solved' || data.status === 'completed') {
                return {
                    request: req,
                    classification: data.classification || 'EXACT_SYMBOLIC_ODE',
                    solutions: data.result || [],
                    trace: data.steps || [],
                    warnings: data.warnings || [],
                    status: 'exact_symbolic'
                };
            } else if (data.status === 'no_solution' || data.status === 'unsupported') {
                return {
                    request: req,
                    classification: 'unsupported',
                    solutions: [],
                    trace: data.steps || [],
                    warnings: data.warnings || [],
                    status: data.status
                };
            }
            return null;

        } catch(e) {
            return null; // Fallback to TS
        }
    }

    public async executePythonSystemODE(req: SystemODERequest): Promise<SystemODEResult | null> {
        try {
            const payload = {
                operation: 'solve_system_ode',
                phase: '9',
                mode: req.mode || 'auto',
                input: {
                    equations: req.equations,
                    independentVariable: req.independentVariable,
                    dependentVariables: req.dependentVariables
                }
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) return null;

            const data = await res.json();
            
            if (data.status === 'solved' || data.status === 'completed') {
                return {
                    request: req,
                    classification: data.classification || 'SYSTEM_ODE_EXACT',
                    solutions: data.result || [],
                    trace: data.steps || [],
                    warnings: data.warnings || [],
                    status: 'exact_symbolic'
                };
            } else if (data.status === 'no_solution' || data.status === 'unsupported') {
                return {
                    request: req,
                    classification: 'unsupported',
                    solutions: [],
                    trace: data.steps || [],
                    warnings: data.warnings || [],
                    status: data.status
                };
            }
            return null;

        } catch(e) {
            return null; // Fallback to TS
        }
    }
}
