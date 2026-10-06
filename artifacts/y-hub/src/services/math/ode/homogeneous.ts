import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';
import { SeparableODEEngine } from './separable';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { EquationEngine } from '../symbolic/equation';
import { ASTUtils } from '../symbolic/utils';
import { PolynomialExpander } from '../symbolic/expander';

import { DomainAnalyzer } from '../domain';
import { SetEngine } from '../symbolic/sets';

export class HomogeneousODEEngine {
    private odeUtils = new ODEUtils();
    private separableEngine = new SeparableODEEngine();
    private simplifier = new SymbolicSimplifier();
    private expander = new PolynomialExpander();
    private eqEngine = new EquationEngine();
    private domainAnalyzer = new DomainAnalyzer();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[] } | null {
        const x = req.independentVariable;
        const y = req.dependentVariable;
        
        if (!this.odeUtils.isHomogeneous(explicitDeriv, x, y)) return null;

        const steps: ODEStep[] = [];
        
        // Substitution: y = vx => v = y/x
        const vVar = 'v_aux';
        
        // For a degree-zero homogeneous function:
        //
        //     F(x,y) = F(1, y/x).
        //
        // Therefore the reduced function of v can be obtained directly
        // as F(1,v). This avoids depending on aggressive factor
        // cancellation such as (x+vx)/(x-vx).
        let F_v = ASTUtils.replaceNode(
            explicitDeriv,
            { type: 'Symbol', name: y },
            { type: 'Symbol', name: vVar }
        );

        F_v = ASTUtils.replaceNode(
            F_v,
            { type: 'Symbol', name: x },
            { type: 'Number', value: '1' }
        );

        F_v = this.simplifier.simplify(F_v);
        
        // Equation in v: v' = (F(v) - v) / x
        const vNode: CanonicalAST = {
            type: 'Symbol',
            name: vVar
        };

        let vDeriv: CanonicalAST;

        if (
            F_v.type === 'Operator' &&
            F_v.operator === '/' &&
            F_v.args.length === 2
        ) {
            const numerator = F_v.args[0];
            const denominator = F_v.args[1];

            // F(v)-v = [A(v)-vB(v)]/B(v)
            const reducedNumerator =
                this.simplifier.simplify(
                    this.expander.expand({
                        type: 'Operator',
                        operator: '-',
                        args: [
                            numerator,
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [vNode, denominator]
                            }
                        ]
                    })
                );

            // Keep x and v factors structurally separated.
            vDeriv = this.simplifier.simplify({
                type: 'Operator',
                operator: '*',
                args: [
                    {
                        type: 'Operator',
                        operator: '^',
                        args: [
                            { type: 'Symbol', name: x },
                            { type: 'Number', value: '-1' }
                        ]
                    },
                    {
                        type: 'Operator',
                        operator: '/',
                        args: [
                            reducedNumerator,
                            denominator
                        ]
                    }
                ]
            });
        } else {
            vDeriv = this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [
                    {
                        type: 'Operator',
                        operator: '-',
                        args: [F_v, vNode]
                    },
                    { type: 'Symbol', name: x }
                ]
            });
        }

        const vReq: ODERequest = {
            ...req,
            dependentVariable: vVar,
            derivativeVariable: vVar + '_prime',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: vVar + '_prime' }, rhs: vDeriv }
        };

        steps.push({
            strategy: 'Homogeneous ODE',
            inputExpression: req.equation,
            transformation: `Substituted y = vx`,
            resultingExpression: vReq.equation
        });

        const sepRes = this.separableEngine.solve(vReq, vDeriv, context);
        if (!sepRes) return null;

        steps.push(...sepRes.steps);

        const solutions: ODESolution[] = [];

        // Back-substitution: v = y/x
        const y_over_x = { type: 'Operator', operator: '/', args: [{ type: 'Symbol', name: y }, { type: 'Symbol', name: x }] } as CanonicalAST;

        // Compute the domain only when no unresolved restrictions exist.
        let origDomainSet: ODESolution['domain'] = null;
        try {
            const restrictions = this.domainAnalyzer.analyze(explicitDeriv);
            if (restrictions.length === 0) {
                origDomainSet = SetEngine.createRealLine(x);
            }
        } catch (e) {}

        const transDomainSet = {
            type: 'SolutionSet', variable: x, domainRestrictions: [`${x} != 0 (transformation condition)`],
            intervals: [
                { left: { type: 'infinity', sign: -1 }, right: { type: 'value', ast: { type: 'Number', value: '0' } }, leftClosed: false, rightClosed: false },
                { left: { type: 'value', ast: { type: 'Number', value: '0' } }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }
            ]
        } as any;

        for (const sol of sepRes.solutions) {
            if (sol.type === 'explicit' || sol.type === 'equilibrium') {
                const implicitEq = { type: 'Equation', lhs: y_over_x, rhs: sol.equation.rhs } as CanonicalAST;
                
                const ySols = this.eqEngine.solveEquation(implicitEq, y);
                const validSols = ySols.filter(s => s.status === 'exact' && s.value);
                
                if (validSols.length > 0) {
                    for (const s of validSols) {
                        let solDomainSet: ODESolution['domain'] = null;
                        try {
                            const restrictions =
                                this.domainAnalyzer.analyze(s.value!);

                            if (restrictions.length === 0) {
                                solDomainSet =
                                    SetEngine.createRealLine(x);
                            }
                        } catch(e) {}
                        
                        let validityInterval = solDomainSet;
                        if (origDomainSet && solDomainSet) {
                            validityInterval = {
                                type: 'SolutionSet', variable: x, domainRestrictions: [],
                                intervals: SetEngine.intersection(origDomainSet.intervals, solDomainSet.intervals)
                            };
                        }

                        solutions.push({
                            type: 'explicit',
                            equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: s.value! },
                            domain: solDomainSet, 
                            original_ode_domain: origDomainSet,
                            transformation_domain: transDomainSet,
                            solution_validity_interval: validityInterval,
                            assumptions: [`${x} != 0 (transformation condition)`]
                        });
                    }
                } else {
                    solutions.push({
                        type: 'implicit',
                        equation: implicitEq,
                        domain: null,
                        original_ode_domain: origDomainSet,
                        transformation_domain: transDomainSet,
                        solution_validity_interval: null,
                        assumptions: [`${x} != 0 (transformation condition)`]
                    });
                }
            } else if (sol.type === 'implicit') {
                const eq = ASTUtils.replaceNode(sol.equation, { type: 'Symbol', name: vVar }, y_over_x);
                solutions.push({
                    type: 'implicit',
                    equation: eq as CanonicalAST,
                    domain: null,
                    original_ode_domain: origDomainSet,
                    transformation_domain: transDomainSet,
                    solution_validity_interval: null,
                    assumptions: [`${x} != 0 (transformation condition)`]
                });
            }
        }

        return { solutions, steps };
    }
}
