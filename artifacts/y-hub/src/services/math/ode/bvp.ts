import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DerivativeEngine } from '../symbolic/derivative';

export class BVPEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();

    public solveBVP(req: ODERequest, solutions: ODESolution[]): { particularSolution?: ODESolution, classification: 'unique_solution' | 'multiple_solutions' | 'no_solution' | 'not_established' } {
        if (!req.boundaryConditions || req.boundaryConditions.length !== 2) return { classification: 'not_established' };
        
        const xVar = req.independentVariable;
        
        for (const sol of solutions) {
            if (sol.type === 'explicit') {
                const f_x = sol.equation.rhs;
                
                const bc1 = req.boundaryConditions[0];
                const bc2 = req.boundaryConditions[1];
                
                const eq1 = this.simplifier.simplify(ASTUtils.replaceNode(f_x, { type: 'Symbol', name: xVar }, bc1.x));
                const eq2 = this.simplifier.simplify(ASTUtils.replaceNode(f_x, { type: 'Symbol', name: xVar }, bc2.x));
                
                const extractCoeff = (expr: CanonicalAST, cName: string): CanonicalAST => {
                    try { return this.simplifier.simplify(this.dEngine.differentiate(expr, cName)); } catch { return { type: 'Number', value: '0' }; }
                };
                const extractConst = (expr: CanonicalAST): CanonicalAST => {
                    let e = ASTUtils.replaceNode(expr, { type: 'Symbol', name: 'C1' }, { type: 'Number', value: '0' });
                    e = ASTUtils.replaceNode(e, { type: 'Symbol', name: 'C2' }, { type: 'Number', value: '0' });
                    return this.simplifier.simplify(e);
                };
                
                const a11 = extractCoeff(eq1, 'C1');
                const a12 = extractCoeff(eq1, 'C2');
                const c1_const = extractConst(eq1);
                
                const a21 = extractCoeff(eq2, 'C1');
                const a22 = extractCoeff(eq2, 'C2');
                const c2_const = extractConst(eq2);
                
                const b1 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [bc1.y, c1_const] });
                const b2 = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [bc2.y, c2_const] });
                
                const det = this.simplifier.simplify({
                    type: 'Operator', operator: '-', args: [
                        { type: 'Operator', operator: '*', args: [a11, a22] },
                        { type: 'Operator', operator: '*', args: [a12, a21] }
                    ]
                });
                
                if (det.type === 'Number' && det.value === '0') {
                    // Check if b1/a11 == b2/a21 (proportional)
                    const num1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [b1, a21] });
                    const num2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [b2, a11] });
                    const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [num1, num2] });
                    
                    if (diff.type === 'Number' && diff.value === '0') {
                        return { classification: 'multiple_solutions' };
                    } else {
                        return { classification: 'no_solution' };
                    }
                }
                
                const numC1 = this.simplifier.simplify({
                    type: 'Operator', operator: '-', args: [
                        { type: 'Operator', operator: '*', args: [b1, a22] },
                        { type: 'Operator', operator: '*', args: [b2, a12] }
                    ]
                });
                const numC2 = this.simplifier.simplify({
                    type: 'Operator', operator: '-', args: [
                        { type: 'Operator', operator: '*', args: [b2, a11] },
                        { type: 'Operator', operator: '*', args: [b1, a21] }
                    ]
                });
                
                const valC1 = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [numC1, det] });
                const valC2 = this.simplifier.simplify({ type: 'Operator', operator: '/', args: [numC2, det] });
                
                let particularEq = ASTUtils.replaceNode(sol.equation, { type: 'Symbol', name: 'C1' }, valC1);
                particularEq = ASTUtils.replaceNode(particularEq, { type: 'Symbol', name: 'C2' }, valC2);
                
                return {
                    particularSolution: { type: 'particular', equation: this.simplifier.simplify(particularEq as CanonicalAST), domain: sol.domain, assumptions: sol.assumptions },
                    classification: 'unique_solution'
                };
            }
        }

        return { classification: 'not_established' };
    }
}

