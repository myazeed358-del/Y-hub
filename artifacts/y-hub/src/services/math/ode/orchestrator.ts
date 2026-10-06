import { CanonicalAST } from '../types/ast';
import { ODERequest, ODEResult, ODEStep, ODEOrchestrationContext, ODEClassification } from '../types/ode';
import { ODEUtils } from './utils';
import { DomainAnalyzer } from '../domain';
import { ExactODEEngine } from './exact';
import { SeparableODEEngine } from './separable';
import { LinearODEEngine } from './linear';
import { BernoulliODEEngine } from './bernoulli';
import { HomogeneousODEEngine } from './homogeneous';
import { AutonomousODEEngine } from './autonomous';
import { NumericalODEEngine } from './numerical';
import { SecondOrderLinearODEEngine } from './second_order_linear';
import { ReductionOfOrderEngine } from './reduction_of_order';
import { HigherOrderLinearODEEngine } from './higher_order';
import { IVPEngine } from './ivp';
import { BVPEngine } from './bvp';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';

import { ODEAdapter } from '../python/ODEAdapter';

export class ODEOrchestrator {
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
    private odeUtils = new ODEUtils();
    private domainAnalyzer = new DomainAnalyzer();
    private simplifier = new SymbolicSimplifier();
    private derivativeEngine = new DerivativeEngine();
    private ivpEngine = new IVPEngine();
    private bvpEngine = new BVPEngine();

    private firstOrderStrategies = [
        { name: 'separable', engine: new SeparableODEEngine() },
        { name: 'homogeneous', engine: new HomogeneousODEEngine() },
        { name: 'linear', engine: new LinearODEEngine() },
        { name: 'exact', engine: new ExactODEEngine() },
        { name: 'bernoulli', engine: new BernoulliODEEngine() }
    ];

    private higherOrderStrategies = [
        { name: 'second_order_linear', engine: new SecondOrderLinearODEEngine() },
        { name: 'reduction_of_order', engine: new ReductionOfOrderEngine() },
        { name: 'higher_order', engine: new HigherOrderLinearODEEngine() }
    ];

    private numericalEngine = new NumericalODEEngine();

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
            return this.routeNumerical(req, context, trace, warnings);
        }

        if (req.higherDerivatives && req.higherDerivatives.length > 0) {
            return this.routeSymbolicHigherOrder(req, context, trace, warnings);
        }

        return this.routeSymbolicFirstOrder(req, context, trace, warnings);
    }

    private routeSymbolicHigherOrder(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
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
                        if (ivpRes.particularSolution) {
                            particularSol = ivpRes.particularSolution;

                            let verifiedODE = false;
                            const y_x = particularSol.equation.rhs;
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
                        if (bvpRes.particularSolution) {
                            particularSol = bvpRes.particularSolution;

                            const y_x = particularSol.equation.rhs;
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
                                return this.buildResult(req, 'BVP' as any, 'no_solution', trace, warnings);
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
                    return this.buildResult(req, strategy.name as any, 'resource_limit', trace, warnings);
                }
                warnings.push(`Strategy ${strategy.name} failed: ${e.message}`);
            }

            context.activeStrategies.delete(strategy.name);
            context.depth--;
        }

        return this.buildResult(req, 'unsupported', 'unsupported', trace, warnings);
    }

    private routeSymbolicFirstOrder(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
        const norm = this.odeUtils.normalizeToExplicitDerivative(req.equation, req.derivativeVariable);
        if (!norm) {
            return this.buildResult(req, 'unsupported', 'unsupported', trace, warnings);
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

                        if (particularSol && ivpValidity === 'established') {
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
                    return this.buildResult(req, strategy.name as any, 'resource_limit', trace, warnings);
                }
                warnings.push(`Strategy ${strategy.name} failed: ${e.message}`);
            }

            context.activeStrategies.delete(strategy.name);
            context.depth--;
        }

        return this.buildResult(req, 'unsupported', 'unsupported', trace, warnings);
    }

    private routeNumerical(req: ODERequest, context: ODEOrchestrationContext, trace: ODEStep[], warnings: string[]): ODEResult {
        try {
            const norm = this.odeUtils.normalizeToExplicitDerivative(
                req.equation,
                req.derivativeVariable
            );

            if (!norm) {
                return this.buildResult(
                    req,
                    'NUMERICAL_ODE',
                    'unresolved',
                    trace,
                    warnings
                );
            }

            const res = this.numericalEngine.solve(req, norm.explicit);

            if (!res) {
                return this.buildResult(
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
            return this.buildResult(
                req,
                'NUMERICAL_ODE',
                'unresolved',
                trace,
                warnings
            );
        }
    }

    private buildResult(req: ODERequest, cls: ODEClassification, status: ODEResult['status'], trace: ODEStep[], warnings: string[]): ODEResult {
        return {
            request: req,
            classification: cls,
            solutions: [],
            trace,
            warnings,
            status
        };
    }
}


import { LinearSystemODEEngine } from './system_linear';
import { SystemIVPEngine } from './system_ivp';
import { PhasePlaneEngine } from './phase_plane';
import { SystemODERequest, SystemODEResult } from '../types/ode';

export class SystemODEOrchestrator {
    private adapter = new ODEAdapter();

    public async executeAsync(req: SystemODERequest): Promise<SystemODEResult> {
    try {
        const pyRes = await this.adapter.executePythonSystemODE(req);
        if (pyRes !== null) {
            if (pyRes.status === 'exact_symbolic' || pyRes.status === 'numerical_approximation' || pyRes.status === 'unsupported' || pyRes.classification === 'unsupported') {
                (pyRes as any).provider = 'python';
                return pyRes;
            }
        }
    } catch(e) {}
    const tsRes = this.solveSystem(req);
    (tsRes as any).provider = 'fallback_typescript';
    return tsRes;
}
    private linearSystemEngine = new LinearSystemODEEngine();
    private systemIVPEngine = new SystemIVPEngine();
    private phasePlaneEngine = new PhasePlaneEngine();

    public solveSystem(req: SystemODERequest): SystemODEResult {
        const trace: ODEStep[] = [];
        const warnings: string[] = [];

        try {
            const linearRes = this.linearSystemEngine.solve(req);
            if (linearRes) {
                trace.push(...linearRes.steps);

                let classification: any = 'LINEAR_SYSTEM';
                if (linearRes.explanationData && linearRes.explanationData.forcing_vector) {
                    const G = linearRes.explanationData.forcing_vector;
                    const isHomo = G.every((g: any) => g.type === 'Number' && g.value === '0');
                    if (isHomo) classification = 'CONSTANT_COEFFICIENT_SYSTEM';
                    else classification = 'NONHOMOGENEOUS_SYSTEM';
                }

                let particularSolution = undefined;
                let validity: any = undefined;

                if (req.initialCondition) {
                    const ivpRes = this.systemIVPEngine.solve(req, linearRes.solutions);
                    if (ivpRes.particularSolution) {
                        particularSolution = ivpRes.particularSolution;
                        validity = ivpRes.validity;
                        classification = 'SYSTEM_IVP';

                        trace.push({
                            strategy: 'System IVP',
                            inputExpression: req.equations[0],
                            transformation: 'Solved exact constants for initial condition',
                            resultingExpression: req.equations[0]
                        });
                    }
                }

                let phasePlane = undefined;
                if (req.mode === 'qualitative' || !req.initialCondition) {
                    if (linearRes.explanationData && linearRes.explanationData.coefficient_matrix) {
                        const pp = this.phasePlaneEngine.analyze(req, linearRes.explanationData.coefficient_matrix);
                        if (pp) {
                            phasePlane = pp;
                            classification = classification === 'SYSTEM_IVP' ? classification : 'PHASE_PLANE_SYSTEM';
                        }
                    }
                }

                return {
                    request: req,
                    classification,
                    solutions: linearRes.solutions,
                    particularSolution,
                    initialConditionValidity: validity,
                    phasePlane,
                    explanationData: linearRes.explanationData,
                    trace,
                    warnings,
                    status: 'exact_symbolic'
                };
            }
        } catch(e: any) {
            if (e.message === 'resource_limit') {
                return { request: req, classification: 'unsupported', solutions: [], trace, warnings, status: 'resource_limit' };
            }
        }

        return { request: req, classification: 'unsupported', solutions: [], trace, warnings, status: 'unsupported' };
    }
}







