import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { IntegrationEngine } from '../symbolic/integration';
import { ODEUtils } from './utils';
import { DomainAnalyzer } from '../domain';

export class ReductionOfOrderEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private iEngine = new IntegrationEngine();
    private utils = new ODEUtils();
    private domainAnalyzer = new DomainAnalyzer();

    public solve(req: ODERequest): { solutions: ODESolution[], steps: ODEStep[] } | null {
        if (!req.knownSolutions || req.knownSolutions.length === 0) return null;
        if (!req.higherDerivatives || req.higherDerivatives.length !== 1) return null;

        const y1 = req.knownSolutions[0];
        const x = req.independentVariable;
        const y = req.dependentVariable;
        const yp = req.derivativeVariable;
        const ypp = req.higherDerivatives[0];

        const linRes = this.utils.isLinearNthOrder(req.equation, y, [yp, ypp]);
        if (!linRes) return null;

        const [a0, a1, a2] = linRes.coeffs;
        const g = linRes.rhs;

        const y1p = this.simplifier.simplify(this.dEngine.differentiate(y1, x));

        // a2 * y1 * w' + (2 a2 y1' + a1 y1) * w = g
        // We know w = v', v = integral(w dx), y = v * y1
        // Solve for w as a first order linear ODE: w' + P(x) w = Q(x)
        // P(x) = (2 a2 y1' + a1 y1) / (a2 y1)
        // Q(x) = g / (a2 y1)
        
        const P_num = this.simplifier.simplify({
            type: 'Operator', operator: '+', args: [
                { type: 'Operator', operator: '*', args: [ { type: 'Number', value: '2' }, { type: 'Operator', operator: '*', args: [a2, y1p] } ] },
                { type: 'Operator', operator: '*', args: [a1, y1] }
            ]
        });
        
        const a2y1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [a2, y1] });
        
        const P = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [P_num, a2y1] });
        const Q = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [g, a2y1] });

        try {
            // Integrating factor: I = e^(int P dx)
            const intP = this.iEngine.integrate(P, x, []);
            const I = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [intP] });

            // w = (int(I Q dx) + C1) / I
            const IQ = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [I, Q] });
            const intIQ = this.iEngine.integrate(IQ, x, []);
            
            const wPart = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [intIQ, I] });
            const wC1 = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [{ type: 'Symbol', name: 'C1' }, I] });
            const w = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [wPart, wC1] });
            
            // v = int(w dx) + C2
            const vPart = this.iEngine.integrate(w, x, []);
            const v = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [vPart, { type: 'Symbol', name: 'C2' }] });
            
            // y = v * y1
            const y2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [v, y1] });

            const domain = this.domainAnalyzer.analyzeDomain(y2, x);
            
            return {
                solutions: [{
                    type: 'explicit',
                    equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: y2 },
                    domain,
                    assumptions: [\\ not in roots(a2 * y1)\]
                }],
                steps: [{
                    strategy: 'Reduction of Order',
                    inputExpression: req.equation,
                    transformation: \Substituted y = v * \\,
                    resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: y2 }
                }]
            };
        } catch (e) {
            return null;
        }
    }

    private formatAST(ast: CanonicalAST): string {
        return 'y1';
    }
}

