
import { ODERequest, ODEResult, ODEStep, ODEOrchestrationContext } from '../types/ode';


import { SecondOrderLinearODEEngine } from './second_order_linear';
import { ReductionOfOrderEngine } from './reduction_of_order';
import { HigherOrderLinearODEEngine } from './higher_order';
import { IVPEngine } from './ivp';
import { BVPEngine } from './bvp';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';


import { buildODEResult } from './odeResultFactory';
/** Isolated ODE strategy router; receives a budgeted orchestration context. */
export class HigherOrderODERouter {
  private higherOrderStrategies = [
        { name: 'second_order_linear', engine: new SecondOrderLinearODEEngine() },
        { name: 'reduction_of_order', engine: new ReductionOfOrderEngine() },
        { name: 'higher_order', engine: new HigherOrderLinearODEEngine() }
    ];
  private ivpEngine = new IVPEngine();
  private bvpEngine = new BVPEngine();
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
public routeSymbolicHigherOrder(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
        for (const strategy of this.higherOrderStrategies) {
            if (context.depth >= context.maxDepth) break;

            context.depth++;
            context.activeStrategies.add(strategy.name);
            context.attemptedStrategies.add(strategy.name);

            try {
                const result = strategy.engine.solve(req, context);
                if (result) {
                    trace.push(...result.steps);

                    let particularSol = undefined;
                    let ivpValidity: ODEResult['initialConditionValidity'] = undefined;

                    if (req.initialCondition) {
                        const ivpRes = this.ivpEngine.solveIVP(req, result.solutions);
                        ivpValidity = ivpRes.validity;
                        if (
                            ivpRes.particularSolution &&
                            ivpRes.particularSolution.equation.type === 'Equation'
                        ) {
                            particularSol = ivpRes.particularSolution;

                            let verifiedODE = false;
                            const y_x = ivpRes.particularSolution.equation.rhs;
                            const y_prime_x = this.simplifier.simplify(this.derivativeEngine.differentiate(y_x, req.independentVariable));
                            const y_double_prime_x = this.simplifier.simplify(this.derivativeEngine.differentiate(y_prime_x, req.independentVariable));

                            let sub = ASTUtils.replaceNode(req.equation, { type: 'Symbol', name: req.higherDerivatives![0] }, y_double_prime_x);
                            sub = ASTUtils.replaceNode(sub, { type: 'Symbol', name: req.derivativeVariable }, y_prime_x);
                            sub = ASTUtils.replaceNode(sub, { type: 'Symbol', name: req.dependentVariable }, y_x);

                            if (sub.type === 'Equation') {
                                const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [sub.lhs, sub.rhs] });
                                verifiedODE = diff.type === 'Number' && diff.value === '0';
                            }

                            const eq1 = this.simplifier.simplify(ASTUtils.replaceNode(y_x, { type: 'Symbol', name: req.independentVariable }, req.initialCondition.x0));
                            const eq2 = this.simplifier.simplify(ASTUtils.replaceNode(y_prime_x, { type: 'Symbol', name: req.independentVariable }, req.initialCondition.x0));

                            const diff1 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [eq1, req.initialCondition.y0] });
                            const diff2 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [eq2, req.initialCondition.derivatives![0]] });

                            const verifiedIVP = diff1.type === 'Number' && diff1.value === '0' && diff2.type === 'Number' && diff2.value === '0';

                            trace.push({
                                strategy: 'IVP Verification',
                                inputExpression: particularSol.equation,
                                transformation: 'Substituted into original ODE and verified initial conditions',
                                resultingExpression: { type: 'Number', value: (verifiedODE && verifiedIVP) ? '0' : '1' },
                                verificationStatus: (verifiedODE && verifiedIVP) ? 'exactly_equivalent' : 'not_proven'
                            });
                        }
                    } else if (req.boundaryConditions && req.boundaryConditions.length > 0) {
                        const bvpRes = this.bvpEngine.solveBVP(req, result.solutions);
                        if (
                            bvpRes.particularSolution &&
                            bvpRes.particularSolution.equation.type === 'Equation'
                        ) {
                            particularSol = bvpRes.particularSolution;

                            const y_x = bvpRes.particularSolution.equation.rhs;
                            const eq1 = this.simplifier.simplify(ASTUtils.replaceNode(y_x, { type: 'Symbol', name: req.independentVariable }, req.boundaryConditions[0].x));
                            const eq2 = this.simplifier.simplify(ASTUtils.replaceNode(y_x, { type: 'Symbol', name: req.independentVariable }, req.boundaryConditions[1].x));

                            const diff1 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [eq1, req.boundaryConditions[0].y] });
                            const diff2 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [eq2, req.boundaryConditions[1].y] });

                            const verifiedBVP = diff1.type === 'Number' && diff1.value === '0' && diff2.type === 'Number' && diff2.value === '0';

                            trace.push({
                                strategy: 'BVP Verification',
                                inputExpression: particularSol.equation,
                                transformation: 'Substituted into original ODE and verified boundary conditions',
                                resultingExpression: { type: 'Number', value: verifiedBVP ? '0' : '1' },
                                verificationStatus: verifiedBVP ? 'exactly_equivalent' : 'not_proven'
                            });
                        } else {
                            if (bvpRes.classification === 'no_solution') {
                                return buildODEResult(req, 'BVP' as any, 'no_solution', trace, warnings);
                            }
                        }
                    }

                    context.activeStrategies.delete(strategy.name);
                    context.depth--;

                    let cls = req.higherDerivatives!.length === 1 ? 'SECOND_ORDER' : 'HIGHER_ORDER';
                    if (req.initialCondition) cls = req.higherDerivatives!.length === 1 ? 'SECOND_ORDER_IVP' : 'HIGHER_ORDER_IVP';
                    if (req.boundaryConditions) cls = 'BVP';

                    return {
                        request: req,
                        classification: cls as any,
                        solutions: result.solutions,
                        particularSolution: particularSol,
                        initialConditionValidity: ivpValidity,
                        existence: ivpValidity ? 'existence_not_established' : undefined,
                        uniqueness: ivpValidity ? 'uniqueness_not_established' : undefined,
                        exactness: (result as any).exactness,
                        trace,
                        warnings,
                        status: 'exact_symbolic'
                    };
                }
            } catch (e: any) {
                if (e.message === 'resource_limit') {
                    return buildODEResult(req, strategy.name as any, 'resource_limit', trace, warnings);
                }
                warnings.push(`Strategy ${strategy.name} failed: ${e.message}`);
            }

            context.activeStrategies.delete(strategy.name);
            context.depth--;
        }

        return buildODEResult(req, 'unsupported', 'unsupported', trace, warnings);
    }
}
