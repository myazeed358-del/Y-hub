import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';
import { IntegrationEngine } from '../symbolic/integration';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { SetEngine } from '../symbolic/sets';
import { DomainAnalyzer } from '../domain';
import { InequalityEngine } from '../symbolic/inequality';

export class LinearODEEngine {
    private odeUtils = new ODEUtils();
    private intEngine = new IntegrationEngine();
    private simplifier = new SymbolicSimplifier();
    private domainAnalyzer = new DomainAnalyzer();
    private ineqEngine = new InequalityEngine();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[] } | null {
        const linearForm = this.odeUtils.isLinear(explicitDeriv, req.independentVariable, req.dependentVariable);
        if (!linearForm) return null;

        const { P, Q } = linearForm;
        const x = req.independentVariable;
        const steps: ODEStep[] = [];
        
        steps.push({
            strategy: 'Linear ODE',
            inputExpression: req.equation,
            transformation: 'Matched standard form y\' + P(x)y = Q(x)',
            resultingExpression: { type: 'Equation', lhs: { type: 'Operator', operator: '+', args: [{ type: 'Symbol', name: req.derivativeVariable }, { type: 'Operator', operator: '*', args: [P, { type: 'Symbol', name: req.dependentVariable }] }] }, rhs: Q }
        });

        const intContext = { ...context, activeStrategies: new Set<string>(), attemptedStrategies: new Set<string>() };

        let intP: CanonicalAST;
        try {
            intP = this.intEngine.integrate(P, x, [], 0, intContext);
        } catch (e) {
            return null;
        }

        const mu = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [intP] });

        steps.push({
            strategy: 'Integrating Factor',
            inputExpression: P,
            transformation: 'Calculated integrating factor μ(x) = exp(∫P(x)dx)',
            resultingExpression: mu
        });

        const muQ = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [mu, Q] });
        
        let intMuQ: CanonicalAST;
        try {
            intMuQ = this.intEngine.integrate(muQ, x, [], 0, intContext);
        } catch (e) {
            return null;
        }

        const C = { type: 'Symbol', name: 'C' } as CanonicalAST;
        const num = { type: 'Operator', operator: '+', args: [intMuQ, C] } as CanonicalAST;
        const yExplicit = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [num, mu] });

        let solutionDomain = null;

        try {
            solutionDomain = this.analyzeDomain(yExplicit, x);
        } catch {
            // A valid symbolic ODE solution must not be discarded merely
            // because the domain analyzer cannot solve a symbolic restriction.
            solutionDomain = null;
        }

        const solutions: ODESolution[] = [{
            type: 'explicit',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: req.dependentVariable }, rhs: yExplicit },
            domain: solutionDomain,
            assumptions: []
        }];

        return { solutions, steps };
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
