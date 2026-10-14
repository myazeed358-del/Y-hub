
import { ODERequest, ODEResult, ODEStep, ODEOrchestrationContext } from '../types/ode';


import { ODEAdapter } from '../python/ODEAdapter';
import { HigherOrderODERouter } from './HigherOrderODERouter';
import { FirstOrderODERouter } from './FirstOrderODERouter';
import { NumericalODERouter } from './NumericalODERouter';

export class ODEOrchestrator {
    private higherOrderRouter = new HigherOrderODERouter();
    private firstOrderRouter = new FirstOrderODERouter();
    private numericalRouter = new NumericalODERouter();
    private adapter = new ODEAdapter();

    public async executeAsync(req: ODERequest): Promise<ODEResult> {
    try {
        const pyRes = await this.adapter.executePythonODE(req);
        if (pyRes !== null) {
            if (pyRes.status === 'exact_symbolic' || pyRes.status === 'numerical_approximation' || pyRes.status === 'unsupported' || pyRes.classification === 'unsupported') {
                (pyRes as any).provider = 'python';
                return pyRes;
            }
        }
    } catch(e) {}
    const tsRes = this.solve(req);
    (tsRes as any).provider = 'fallback_typescript';
    return tsRes;
}


    /**
     * Backward-compatible facade for the Phase 7 API.
     *
     * solve() remains the canonical modern API. The legacy facade only
     * translates the historical numerical classification expected by
     * older callers.
     */
    public orchestrate(req: ODERequest): ODEResult {
        const result = this.solve(req);

        if (result.classification !== 'NUMERICAL_ODE') {
            return result;
        }

        return {
            ...result,
            classification: 'numerical'
        };
    }

    public solve(req: ODERequest): ODEResult {
        const trace: ODEStep[] = [];
        const warnings: string[] = [];
        const context: ODEOrchestrationContext = {
            activeStrategies: new Set(),
            attemptedStrategies: new Set(),
            depth: 0,
            transformationCount: 0,
            maxDepth: req.maxDepth || 10,
            maxAttempts: req.maxAttempts || 20,
            maxTransformations: req.maxTransformations || 50
        };

        if (req.mode === 'numerical') {
            return this.numericalRouter.routeNumerical(req, context, trace, warnings);
        }

        if (req.higherDerivatives && req.higherDerivatives.length > 0) {
            return this.higherOrderRouter.routeSymbolicHigherOrder(req, context, trace, warnings);
        }

        return this.firstOrderRouter.routeSymbolicFirstOrder(req, context, trace, warnings);
    }


}

// Compatibility export: existing imports keep working.
export { SystemODEOrchestrator } from './system_orchestrator';
