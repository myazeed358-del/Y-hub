
import { ODERequest, ODEResult, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';


import { NumericalODEEngine } from './numerical';


import { buildODEResult } from './odeResultFactory';
/** Isolated ODE strategy router; receives a budgeted orchestration context. */
export class NumericalODERouter {
  private odeUtils = new ODEUtils();
  private numericalEngine = new NumericalODEEngine();
public routeNumerical(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
        try {
            const norm = this.odeUtils.normalizeToExplicitDerivative(
                req.equation,
                req.derivativeVariable
            );

            if (!norm) {
                return buildODEResult(
                    req,
                    'NUMERICAL_ODE',
                    'unresolved',
                    trace,
                    warnings
                );
            }

            const res = this.numericalEngine.solve(req, norm.explicit);

            if (!res) {
                return buildODEResult(
                    req,
                    'NUMERICAL_ODE',
                    'unresolved',
                    trace,
                    warnings
                );
            }

            trace.push({
                strategy: 'Numerical Integration',
                inputExpression: req.equation,
                transformation: 'Executed numerical method',
                resultingExpression: req.equation
            });

            return {
                request: req,
                classification: 'NUMERICAL_ODE',
                solutions: [],
                numerical: res,
                trace,
                warnings,
                status: 'numerical_approximation'
            };
        } catch (e: any) {
            warnings.push(`Numerical integration failed: ${e?.message ?? e}`);
            return buildODEResult(
                req,
                'NUMERICAL_ODE',
                'unresolved',
                trace,
                warnings
            );
        }
    }
}
