import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';
import { IntegrationEngine } from '../symbolic/integration';
import { EquationEngine } from '../symbolic/equation';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DomainAnalyzer } from '../domain';
import { SetEngine } from '../symbolic/sets';
import { InequalityEngine } from '../symbolic/inequality';

export class SeparableODEEngine {
    private odeUtils = new ODEUtils();
    private intEngine = new IntegrationEngine();
    private eqEngine = new EquationEngine();
    private simplifier = new SymbolicSimplifier();
    private domainAnalyzer = new DomainAnalyzer();
    private ineqEngine = new InequalityEngine();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[] } | null {
        const separated = this.odeUtils.isSeparable(explicitDeriv, req.independentVariable, req.dependentVariable);
        if (!separated) return null;

        const steps: ODEStep[] = [];
        const { gx, hy } = separated;

        steps.push({
            strategy: 'Separable ODE',
            inputExpression: req.equation,
            transformation: `Separated into dy/dx = g(x)h(y) where g(x)=${JSON.stringify(gx)} and h(y)=${JSON.stringify(hy)}`,
            resultingExpression: { type: 'Equation', lhs: { type: 'Operator', operator: '/', args: [{ type: 'Symbol', name: 'dy' }, hy] }, rhs: { type: 'Operator', operator: '*', args: [gx, { type: 'Symbol', name: 'dx' }] } }
        });

        // Lost solutions: h(y) = 0
        const lostSolutions = this.findEquilibriumSolutions(hy, req.dependentVariable);

        // Integrate LHS: ∫ 1/h(y) dy
        const invHy = this.buildReciprocal(hy);
        
        // Use integration engine, we need an orchestrator context for it
        const intContext = { ...context, activeStrategies: new Set<string>(), attemptedStrategies: new Set<string>() };
        
        let lhsInt: CanonicalAST;
        let rhsInt: CanonicalAST;
        try {
            lhsInt = this.intEngine.integrate(invHy, req.dependentVariable, [], 0, intContext);
            rhsInt = this.intEngine.integrate(gx, req.independentVariable, [], 0, intContext);
        } catch (e) {
            return null; // integration failed
        }

        // Implicit solution: lhsInt = rhsInt + C
        const C = { type: 'Symbol', name: 'C' } as CanonicalAST;
        const implicitEq = { type: 'Equation', lhs: lhsInt, rhs: { type: 'Operator', operator: '+', args: [rhsInt, C] } } as CanonicalAST;

        steps.push({
            strategy: 'Separable ODE Integration',
            inputExpression: invHy,
            transformation: 'Integrated both sides',
            resultingExpression: implicitEq
        });

        const solutions: ODESolution[] = [];

        // Try to solve for y explicitly
        const explicitY = this.eqEngine.solveEquation(implicitEq, req.dependentVariable);
        const validExplicit = explicitY.filter(s => s.status === 'exact' && s.value);
        
        if (validExplicit.length > 0) {
            for (const s of validExplicit) {
                solutions.push({
                    type: 'explicit',
                    equation: { type: 'Equation', lhs: { type: 'Symbol', name: req.dependentVariable }, rhs: s.value! },
                    domain: this.analyzeDomain(s.value!, req.independentVariable),
                    assumptions: [`h(y) != 0 (transformation condition)`]
                });
            }
        } else {
            solutions.push({
                type: 'implicit',
                equation: implicitEq,
                domain: null, 
                assumptions: [`h(y) != 0 (transformation condition)`]
            });
        }

        // Add lost equilibrium solutions
        for (const ls of lostSolutions) {
            solutions.push({
                type: 'equilibrium',
                equation: { type: 'Equation', lhs: { type: 'Symbol', name: req.dependentVariable }, rhs: ls },
                domain: SetEngine.createRealLine(),
                assumptions: []
            });
        }

        return { solutions, steps };
    }

    private buildReciprocal(node: CanonicalAST): CanonicalAST {
        // 1 / (A/B) = B/A
        if (
            node.type === 'Operator' &&
            node.operator === '/' &&
            node.args.length === 2
        ) {
            return this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [node.args[1], node.args[0]]
            });
        }

        // 1 / (A^-1) = A
        if (
            node.type === 'Operator' &&
            node.operator === '^' &&
            node.args[1].type === 'Number' &&
            node.args[1].value === '-1'
        ) {
            return this.simplifier.simplify(node.args[0]);
        }

        // Example:
        //
        // 1 / [A * B^-1]
        // -> B / A
        if (
            node.type === 'Operator' &&
            (
                node.operator === '*' ||
                node.operator === 'implicit_multiply'
            )
        ) {
            const numeratorFactors: CanonicalAST[] = [];
            const denominatorFactors: CanonicalAST[] = [];

            for (const factor of node.args) {
                if (
                    factor.type === 'Operator' &&
                    factor.operator === '^' &&
                    factor.args[1].type === 'Number' &&
                    factor.args[1].value === '-1'
                ) {
                    numeratorFactors.push(factor.args[0]);
                } else {
                    denominatorFactors.push(factor);
                }
            }

            if (numeratorFactors.length > 0) {
                const numerator: CanonicalAST =
                    numeratorFactors.length === 1
                        ? numeratorFactors[0]
                        : {
                            type: 'Operator',
                            operator: '*',
                            args: numeratorFactors
                        };

                const denominator: CanonicalAST =
                    denominatorFactors.length === 0
                        ? { type: 'Number', value: '1' }
                        : denominatorFactors.length === 1
                            ? denominatorFactors[0]
                            : {
                                type: 'Operator',
                                operator: '*',
                                args: denominatorFactors
                            };

                return this.simplifier.simplify({
                    type: 'Operator',
                    operator: '/',
                    args: [numerator, denominator]
                });
            }
        }

        return this.simplifier.simplify({
            type: 'Operator',
            operator: '/',
            args: [
                { type: 'Number', value: '1' },
                node
            ]
        });
    }

    private findEquilibriumSolutions(hy: CanonicalAST, y: string): CanonicalAST[] {
        const eq = { type: 'Equation', lhs: hy, rhs: { type: 'Number', value: '0' } } as CanonicalAST;
        const sols = this.eqEngine.solveEquation(eq, y);
        return sols.filter(s => s.status === 'exact' && s.value && !ASTUtils.isInfinity(s.value)).map(s => s.value!);
    }

    private analyzeDomain(expr: CanonicalAST, x: string) {
        const restrictions = this.domainAnalyzer.analyze(expr);
        let domainSet = SetEngine.createRealLine();
        for (const r of restrictions) {
            if (r.type === 'inverse_trig' || r.type === 'inverse_sec_csc') continue;
            const ineq: CanonicalAST = { type: 'Inequality', operator: r.type === 'denominator' ? '!=' : (r.type === 'even_root' ? '>=' : '>'), lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
            const solved = this.ineqEngine.solve(ineq, x);
            if (solved.kind === 'solution_set') {
                domainSet = { type: 'SolutionSet', variable: x, domainRestrictions: [], intervals: SetEngine.intersection(domainSet.intervals, solved.solution.intervals) };
            }
        }
        return domainSet;
    }
}
