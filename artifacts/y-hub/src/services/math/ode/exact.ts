import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { IntegrationEngine } from '../symbolic/integration';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { EquationEngine } from '../symbolic/equation';
import { ASTUtils } from '../symbolic/utils';

export class ExactODEEngine {
    private intEngine = new IntegrationEngine();
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private eqEngine = new EquationEngine();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[], exactness: 'locally_exact' | 'globally_exact' | 'requires_domain_condition' } | null {
        // Find M and N from explicitDeriv: y' = G(x,y).
        // Best approach: G(x,y) = A/B. M = -A, N = B.
        // Wait, M dx + N dy = 0 => y' = -M/N. So G = -M/N.
        // Let's extract numerator and denominator.
        
        let G = this.simplifier.simplify(explicitDeriv);
        let num: CanonicalAST = G;
        let den: CanonicalAST = { type: 'Number', value: '1' };
        
        if (G.type === 'Operator' && G.operator === '/') {
            num = G.args[0];
            den = G.args[1];
        } else if (G.type === 'Operator' && G.operator === '*') {
            // some parts might have negative exponents
            // but we'll just treat G as num/1.
        }

        const M = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, num] });
        const N = den;
        
        const x = req.independentVariable;
        const y = req.dependentVariable;
        
        try {
            const dMdy = this.simplifier.simplify(this.dEngine.differentiate(M, y));
            const dNdx = this.simplifier.simplify(this.dEngine.differentiate(N, x));
            
            const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [dMdy, dNdx] });
            if (diff.type !== 'Number' || diff.value !== '0') {
                return null; // Not exact
            }
            
            const steps: ODEStep[] = [];
            steps.push({
                strategy: 'Exact ODE',
                inputExpression: req.equation,
                transformation: 'Verified exactness: ∂M/∂y = ∂N/∂x',
                resultingExpression: { type: 'Equation', lhs: dMdy, rhs: dNdx }
            });

            const intContext = { ...context, activeStrategies: new Set<string>(), attemptedStrategies: new Set<string>() };
            
            // Psi = int M dx + h(y)
            const intMdx = this.intEngine.integrate(M, x, [], 0, intContext);
            
            // d(Psi_partial)/dy
            const dIntMdy = this.simplifier.simplify(this.dEngine.differentiate(intMdx, y));
            
            // h'(y) = N - d(Psi_partial)/dy
            const hPrime = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [N, dIntMdy] });
            
            // h(y) = int h'(y) dy
            const hy = this.intEngine.integrate(hPrime, y, [], 0, intContext);
            
            const Psi = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [intMdx, hy] });
            
            const C = { type: 'Symbol', name: 'C' } as CanonicalAST;
            const implicitEq = { type: 'Equation', lhs: Psi, rhs: C } as CanonicalAST;
            
            // Try to find explicit solution for y
            const solutions: ODESolution[] = [];
            const explicitY = this.eqEngine.solveEquation(implicitEq, y);
            const validExplicit = explicitY.filter(s => s.status === 'exact' && s.value);
            
            if (validExplicit.length > 0) {
                for (const s of validExplicit) {
                    solutions.push({
                        type: 'explicit',
                        equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: s.value! },
                        domain: null, // Hard to isolate accurately without full substitution check
                        assumptions: []
                    });
                }
            } else {
                solutions.push({
                    type: 'implicit',
                    equation: implicitEq,
                    domain: null,
                    assumptions: []
                });
            }
            
            return { solutions, steps, exactness: 'locally_exact' };
        } catch {
            return null;
        }
    }
}
