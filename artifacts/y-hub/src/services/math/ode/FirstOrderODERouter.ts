
import { ODERequest, ODEResult, ODEStep, ODEOrchestrationContext, ODEClassification } from '../types/ode';
import { ODEUtils } from './utils';

import { ExactODEEngine } from './exact';
import { SeparableODEEngine } from './separable';
import { LinearODEEngine } from './linear';
import { BernoulliODEEngine } from './bernoulli';
import { HomogeneousODEEngine } from './homogeneous';
import { AutonomousODEEngine } from './autonomous';


import { IVPEngine } from './ivp';

import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';


import { buildODEResult } from './odeResultFactory';
/** Isolated ODE strategy router; receives a budgeted orchestration context. */
export class FirstOrderODERouter {
  private firstOrderStrategies = [
        { name: 'separable', engine: new SeparableODEEngine() },
        { name: 'homogeneous', engine: new HomogeneousODEEngine() },
        { name: 'linear', engine: new LinearODEEngine() },
        { name: 'exact', engine: new ExactODEEngine() },
        { name: 'bernoulli', engine: new BernoulliODEEngine() }
    ];
  private odeUtils = new ODEUtils();
  private ivpEngine = new IVPEngine();
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
public routeSymbolicFirstOrder(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
        const norm = this.odeUtils.normalizeToExplicitDerivative(req.equation, req.derivativeVariable);
        if (!norm) {
            return buildODEResult(req, 'unsupported', 'unsupported', trace, warnings);
        }

        const { explicit: explicitDeriv, assumptions } = norm;
        if (assumptions.length > 0) {
            warnings.push('Normalization assumed denominators != 0.');
        }

        // Autonomous equations are a qualitative-analysis route.
        // Do not run them as a normal symbolic solve() strategy.
        if (req.mode === 'qualitative') {
            try {
                const qualitative = new AutonomousODEEngine().analyze(
                    req,
                    explicitDeriv
                );

                if (qualitative) {
                    trace.push({
                        strategy: 'Autonomous Analysis',
                        inputExpression: req.equation,
                        transformation: 'Analyzed equilibria and phase-line stability',
                        resultingExpression: explicitDeriv
                    });

                    return {
                        request: req,
                        classification: 'autonomous',
                        solutions: [],
                        qualitative,
                        trace,
                        warnings,
                        status: 'exact_symbolic'
                    };
                }
            } catch (e: any) {
                warnings.push(`Autonomous analysis failed: ${e?.message ?? e}`);
            }
        }

        // Try the supported solving methods one at a time.
        for (const strategy of this.firstOrderStrategies) {
            if (context.depth >= context.maxDepth) break;

            context.depth++;
            context.activeStrategies.add(strategy.name);
            context.attemptedStrategies.add(strategy.name);

            try {
                const result = strategy.engine.solve(req, explicitDeriv, context);
                if (result) {
                    trace.push(...result.steps);

                    const verificationSolution =
                        result.solutions.find(
                            solution =>
                                solution.type === 'implicit' ||
                                solution.type === 'explicit'
                        );

                    if (verificationSolution) {
                        try {
                            if (
                                verificationSolution.type === 'implicit' &&
                                verificationSolution.equation.type === 'Equation'
                            ) {
                                const residual =
                                    this.simplifier.simplify({
                                        type: 'Operator',
                                        operator: '-',
                                        args: [
                                            verificationSolution.equation.lhs,
                                            verificationSolution.equation.rhs
                                        ]
                                    });

                                const rx =
                                    this.simplifier.simplify(
                                        this.derivativeEngine.differentiate(
                                            residual,
                                            req.independentVariable
                                        )
                                    );

                                const ry =
                                    this.simplifier.simplify(
                                        this.derivativeEngine.differentiate(
                                            residual,
                                            req.dependentVariable
                                        )
                                    );

                                const check =
                                    this.simplifier.simplify({
                                        type: 'Operator',
                                        operator: '+',
                                        args: [
                                            rx,
                                            {
                                                type: 'Operator',
                                                operator: '*',
                                                args: [
                                                    ry,
                                                    explicitDeriv
                                                ]
                                            }
                                        ]
                                    });

                                trace.push({
                                    strategy: 'Implicit Verification',
                                    inputExpression:
                                        verificationSolution.equation,
                                    transformation:
                                        'Checked R_x + R_y y\' against the original ODE',
                                    resultingExpression: check,
                                    verificationStatus:
                                        check.type === 'Number' &&
                                        check.value === '0'
                                            ? 'exactly_equivalent'
                                            : 'not_proven'
                                });
                            } else if (
                                verificationSolution.type === 'explicit' &&
                                verificationSolution.equation.type === 'Equation'
                            ) {
                                const yExpr =
                                    verificationSolution.equation.rhs;

                                const derivative =
                                    this.simplifier.simplify(
                                        this.derivativeEngine.differentiate(
                                            yExpr,
                                            req.independentVariable
                                        )
                                    );

                                const rhs =
                                    this.simplifier.simplify(
                                        ASTUtils.replaceNode(
                                            explicitDeriv,
                                            {
                                                type: 'Symbol',
                                                name: req.dependentVariable
                                            },
                                            yExpr
                                        )
                                    );

                                const check =
                                    this.simplifier.simplify({
                                        type: 'Operator',
                                        operator: '-',
                                        args: [derivative, rhs]
                                    });

                                trace.push({
                                    strategy: 'Verification',
                                    inputExpression:
                                        verificationSolution.equation,
                                    transformation:
                                        'Differentiated the explicit solution and checked the original ODE',
                                    resultingExpression: check,
                                    verificationStatus:
                                        check.type === 'Number' &&
                                        check.value === '0'
                                            ? 'exactly_equivalent'
                                            : 'not_proven'
                                });
                            }
                        } catch {
                            // Verification failure does not invalidate
                            // the symbolic solution.
                        }
                    }

                    let particularSol = undefined;
                    let ivpValidity: ODEResult['initialConditionValidity'] = undefined;

                    if (req.initialCondition) {
                        const ivpRes = this.ivpEngine.solveIVP(req, result.solutions);
                        ivpValidity = ivpRes.validity;
                        particularSol = ivpRes.particularSolution;

                        if (
                            particularSol &&
                            ivpValidity === 'established' &&
                            particularSol.equation.type === 'Equation'
                        ) {
                            let verifiedODE = false;

                            const y_x = particularSol.equation.rhs;
                            const y_prime_x = this.simplifier.simplify(this.derivativeEngine.differentiate(y_x, req.independentVariable));
                            const F_x_yx = this.simplifier.simplify(ASTUtils.replaceNode(explicitDeriv, { type: 'Symbol', name: req.dependentVariable }, y_x));

                            const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [y_prime_x, F_x_yx] });
                            if (diff.type === 'Number' && diff.value === '0') {
                                verifiedODE = true;
                            }

                            const x0 = req.initialCondition.x0;
                            const y0 = req.initialCondition.y0;
                            const evalY = this.simplifier.simplify(ASTUtils.replaceNode(y_x, { type: 'Symbol', name: req.independentVariable }, x0));
                            const ivpDiff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [evalY, y0] });

                            const verifiedIVP = ivpDiff.type === 'Number' && ivpDiff.value === '0';

                            trace.push({
                                strategy: 'IVP Verification',
                                inputExpression: particularSol.equation,
                                transformation: 'Substituted into original ODE and verified initial condition',
                                resultingExpression: { type: 'Number', value: (verifiedODE && verifiedIVP) ? '0' : '1' },
                                verificationStatus: (verifiedODE && verifiedIVP) ? 'exactly_equivalent' : 'not_proven'
                            });
                        }
                    }

                    context.activeStrategies.delete(strategy.name);
                    context.depth--;

                    return {
                        request: req,
                        classification: strategy.name as ODEClassification,
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
