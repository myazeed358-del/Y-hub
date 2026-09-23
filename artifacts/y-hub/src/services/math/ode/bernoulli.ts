import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';
import { LinearODEEngine } from './linear';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { EquationEngine } from '../symbolic/equation';
import { ASTUtils } from '../symbolic/utils';

export class BernoulliODEEngine {
    private odeUtils = new ODEUtils();
    private linearEngine = new LinearODEEngine();
    private simplifier = new SymbolicSimplifier();
    private eqEngine = new EquationEngine();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[] } | null {
        const bernoulli = this.odeUtils.isBernoulli(explicitDeriv, req.independentVariable, req.dependentVariable);
        if (!bernoulli) return null;

        const { P, Q, n } = bernoulli;
        const x = req.independentVariable;
        const y = req.dependentVariable;

        // n=0 or n=1 reduce to linear, should be handled before or fallback here
        if (n.type === 'Number' && (n.value === '0' || n.value === '1')) return null;

        const steps: ODEStep[] = [];
        
        // Substitution: v = y^(1-n)
        const oneMinusN = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [{ type: 'Number', value: '1' }, n] });
        
        // Linear equation in v: v' + (1-n)P(x)v = (1-n)Q(x)
        // Which means v' = (1-n)Q(x) - (1-n)P(x)v
        const P_new = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [oneMinusN, P] });
        const Q_new = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [oneMinusN, Q] });
        
        const vVar = 'v_aux';
        const vDeriv = { 
            type: 'Operator', operator: '-', args: [
                Q_new, 
                { type: 'Operator', operator: '*', args: [P_new, { type: 'Symbol', name: vVar }] }
            ] 
        } as CanonicalAST;

        const vReq: ODERequest = {
            ...req,
            dependentVariable: vVar,
            derivativeVariable: vVar + '_prime',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: vVar + '_prime' }, rhs: vDeriv }
        };

        const linRes = this.linearEngine.solve(vReq, vDeriv, context);
        if (!linRes) return null;

        steps.push({
            strategy: 'Bernoulli ODE',
            inputExpression: req.equation,
            transformation: `Substituted v = y^(1-n)`,
            resultingExpression: vReq.equation
        });

        // Add linear steps
        steps.push(...linRes.steps);

        const solutions: ODESolution[] = [];

        // Back-substitution: y^(1-n) = v
        for (const sol of linRes.solutions) {
            if (sol.type === 'explicit') {
                const vExpr = sol.equation.rhs;
                const implicitEq = { type: 'Equation', lhs: { type: 'Operator', operator: '^', args: [{ type: 'Symbol', name: y }, oneMinusN] }, rhs: vExpr } as CanonicalAST;
                
                const ySols = this.eqEngine.solveEquation(implicitEq, y);
                const validSols = ySols.filter(s => s.status === 'exact' && s.value);
                
                if (validSols.length > 0) {
                    for (const s of validSols) {
                        solutions.push({
                            type: 'explicit',
                            equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: s.value! },
                            domain: null, 
                            assumptions: [`${y} != 0 (transformation condition)`]
                        });
                    }
                } else {
                    solutions.push({
                        type: 'implicit',
                        equation: implicitEq,
                        domain: null,
                        assumptions: [`${y} != 0 (transformation condition)`]
                    });
                }
            } else {
                // Should not happen for linear engine unless it returns implicit
            }
        }
        
        // Lost solutions check: y=0 might be lost if n > 0.
        // If n > 0, y=0 is a solution.
        if (n.type === 'Number' && n.value !== '0' && !n.value.startsWith('-')) {
            solutions.push({
                type: 'equilibrium',
                equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: { type: 'Number', value: '0' } },
                domain: null,
                assumptions: []
            });
        }

        return { solutions, steps };
    }
}
