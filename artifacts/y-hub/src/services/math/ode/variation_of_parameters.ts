import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DerivativeEngine } from '../symbolic/derivative';
import { IntegrationEngine } from '../symbolic/integration';
import { DomainAnalyzer } from '../domain';

export class VariationOfParametersEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private iEngine = new IntegrationEngine();
    private domainAnalyzer = new DomainAnalyzer();

    public solveParticular(req: ODERequest, y1: CanonicalAST, y2: CanonicalAST, g: CanonicalAST, x: string): { yp: CanonicalAST, steps: ODEStep[], wCondition: CanonicalAST } | null {
        const steps: ODEStep[] = [];
        
        // 1. Wronskian W = y1 y2' - y2 y1'
        const y1p = this.simplifier.simplify(this.dEngine.differentiate(y1, x));
        const y2p = this.simplifier.simplify(this.dEngine.differentiate(y2, x));
        
        const W = this.simplifier.simplify({
            type: 'Operator', operator: '-', args: [
                { type: 'Operator', operator: '*', args: [y1, y2p] },
                { type: 'Operator', operator: '*', args: [y2, y1p] }
            ]
        });
        
        if (W.type === 'Number' && W.value === '0') return null;
        
        const wCondition = { type: 'Inequality', operator: '!=', lhs: W, rhs: { type: 'Number', value: '0' } } as CanonicalAST;
        
        // 2. u1' = -y2 g / W
        const u1p = this.simplifier.simplify({
            type: 'Operator', operator: '/', args: [
                { type: 'Operator', operator: '*', args: [ { type: 'Number', value: '-1' }, { type: 'Operator', operator: '*', args: [y2, g] } ] },
                W
            ]
        });
        
        // 3. u2' = y1 g / W
        const u2p = this.simplifier.simplify({
            type: 'Operator', operator: '/', args: [
                { type: 'Operator', operator: '*', args: [y1, g] },
                W
            ]
        });
        
        try {
            // Integrate
            // We ignore steps output from integration for ODE trace brevity
            const u1 = this.iEngine.integrate(u1p, x, []);
            const u2 = this.iEngine.integrate(u2p, x, []);
            
            const yp = this.simplifier.simplify({
                type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [u1, y1] },
                    { type: 'Operator', operator: '*', args: [u2, y2] }
                ]
            });
            
            steps.push({
                strategy: 'Variation of Parameters',
                inputExpression: g,
                transformation: 'Wronskian evaluated and integrals computed',
                resultingExpression: yp,
                verificationCondition: wCondition
            });
            
            return { yp, steps, wCondition };
        } catch (e) {
            return null;
        }
    }
}

