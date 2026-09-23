import { CanonicalAST } from '../types/ast';
import { ASTUtils } from '../symbolic/utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { EquationEngine } from '../symbolic/equation';

export class ODEUtils {
    private simplifier = new SymbolicSimplifier();
    private eqEngine = new EquationEngine();

    public isLinearNthOrder(eq: CanonicalAST, y: string, yDerivatives: string[]): { coeffs: CanonicalAST[], rhs: CanonicalAST } | null {
        if (eq.type !== 'Equation') return null;
        
        const { DerivativeEngine } = require('../symbolic/derivative');
        const dEngine = new DerivativeEngine();
        
        const F = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [eq.lhs, eq.rhs] });
        const vars = [y, ...yDerivatives];
        const coeffs: CanonicalAST[] = [];
        
        for (const v of vars) {
            try {
                const coeff = this.simplifier.simplify(dEngine.differentiate(F, v));
                // Coefficient must only depend on x, not on y or any of its derivatives
                for (const checkVar of vars) {
                    if (ASTUtils.containsVariable(coeff, checkVar)) return null;
                }
                coeffs.push(coeff);
            } catch {
                return null;
            }
        }
        
        // Find rhs: -F(x, 0, 0, ...)
        let rhsPart = F;
        for (const v of vars) {
            rhsPart = ASTUtils.replaceNode(rhsPart, { type: 'Symbol', name: v }, { type: 'Number', value: '0' });
        }
        rhsPart = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, rhsPart] });
        
        return { coeffs, rhs: rhsPart };
    }

    public normalizeToExplicitDerivative(eq: CanonicalAST, yPrime: string): { explicit: CanonicalAST, assumptions: CanonicalAST[] } | null {
        // Try to solve for yPrime
        if (eq.type !== 'Equation') return null;

        const solutions = this.eqEngine.solveEquation(eq, yPrime);
        
        // Find a unique finite solution for y'
        const validSol = solutions.find(s => s.status === 'exact' && s.value && !ASTUtils.isInfinity(s.value));
        if (validSol && validSol.value) {
            // Check if there are assumptions (e.g. division by expression)
            // Currently EquationEngine might not explicitly return assumptions in the solution array,
            // but we extract denominators from the resulting expression.
            const assumptions: CanonicalAST[] = [];
            this.extractDenominators(validSol.value, assumptions);
            return { explicit: validSol.value, assumptions };
        }
        
        return null;
    }

    private extractDenominators(node: CanonicalAST, assumptions: CanonicalAST[]) {
        if (node.type === 'Operator' && node.operator === '/') {
            assumptions.push(node.args[1]);
        }
        if (node.type === 'Operator' || node.type === 'Function') {
            for (const arg of node.args) {
                this.extractDenominators(arg, assumptions);
            }
        }
    }

    // Checks if the expression matches f(x) * g(y)
    public isSeparable(expr: CanonicalAST, x: string, y: string): { gx: CanonicalAST, hy: CanonicalAST } | null {
        // Simple heuristic: if it's a product, separate factors by variable
        const factors = this.getFactors(expr);
        const gxFactors: CanonicalAST[] = [];
        const hyFactors: CanonicalAST[] = [];
        
        for (const f of factors) {
            const hasX = ASTUtils.containsVariable(f, x);
            const hasY = ASTUtils.containsVariable(f, y);
            if (hasX && hasY) {
                // E.g. sin(x*y) is not separable this easily
                // Wait, if it's something like e^(x+y), it can be separated! e^x * e^y.
                // We assume simplifier handles e^(x+y) -> e^x * e^y.
                return null;
            }
            if (hasY) {
                hyFactors.push(f);
            } else {
                gxFactors.push(f);
            }
        }
        
        const gx = gxFactors.length === 0 ? { type: 'Number', value: '1' } as CanonicalAST :
                   (gxFactors.length === 1 ? gxFactors[0] : { type: 'Operator', operator: '*', args: gxFactors } as CanonicalAST);
        const hy = hyFactors.length === 0 ? { type: 'Number', value: '1' } as CanonicalAST :
                   (hyFactors.length === 1 ? hyFactors[0] : { type: 'Operator', operator: '*', args: hyFactors } as CanonicalAST);
                   
        return { gx: this.simplifier.simplify(gx), hy: this.simplifier.simplify(hy) };
    }

    private getFactors(node: CanonicalAST): CanonicalAST[] {
        if (node.type === 'Operator' && node.operator === '*') {
            const factors: CanonicalAST[] = [];
            for (const a of node.args) {
                factors.push(...this.getFactors(a));
            }
            return factors;
        }
        if (node.type === 'Operator' && node.operator === '/') {
            const num = this.getFactors(node.args[0]);
            const den = this.getFactors(node.args[1]).map(d => ({ type: 'Operator', operator: '^', args: [d, { type: 'Number', value: '-1' }] } as CanonicalAST));
            return [...num, ...den];
        }
        return [node];
    }
    
    // Checks if y' + P(x)y = Q(x)
    // i.e. explicit form is y' = Q(x) - P(x)y
    public isLinear(explicitDeriv: CanonicalAST, x: string, y: string): { P: CanonicalAST, Q: CanonicalAST } | null {
        // G(x, y) = Q(x) - P(x) y
        // If we differentiate G w.r.t y, we should get -P(x), which must be independent of y.
        const { DerivativeEngine } = require('../symbolic/derivative');
        const dEngine = new DerivativeEngine();
        
        try {
            const dGdy = this.simplifier.simplify(dEngine.differentiate(explicitDeriv, y));
            if (ASTUtils.containsVariable(dGdy, y)) {
                return null; // Not linear
            }
            
            const negP = dGdy;
            const P = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, negP] });
            
            // Q(x) = G(x, y) + P(x)y
            // Set y = 0 to get Q(x)!
            const Q = this.simplifier.simplify(ASTUtils.replaceNode(explicitDeriv, { type: 'Symbol', name: y }, { type: 'Number', value: '0' }));
            
            return { P, Q };
        } catch {
            return null;
        }
    }

    // Checks Bernoulli: y' + P(x)y = Q(x)y^n => y' = Q(x)y^n - P(x)y
    public isBernoulli(explicitDeriv: CanonicalAST, x: string, y: string): { P: CanonicalAST, Q: CanonicalAST, n: CanonicalAST } | null {
        // We look for terms in G(x,y).
        // Best approach: G(x,y) / y = Q(x) y^{n-1} - P(x).
        // Let's just do a pattern match on sum of two terms: one with y^1 and one with y^n.
        const terms = this.getTerms(explicitDeriv);
        if (terms.length > 2) return null;
        
        let pyTerm: CanonicalAST | null = null;
        let qynTerm: CanonicalAST | null = null;
        let n: CanonicalAST | null = null;

        for (const t of terms) {
            const factors = this.getFactors(t);
            let yPow: CanonicalAST | null = null;
            let otherFactors: CanonicalAST[] = [];
            
            for (const f of factors) {
                if (f.type === 'Symbol' && f.name === y) {
                    yPow = { type: 'Number', value: '1' };
                } else if (f.type === 'Operator' && f.operator === '^' && f.args[0].type === 'Symbol' && f.args[0].name === y) {
                    yPow = f.args[1];
                } else if (ASTUtils.containsVariable(f, y)) {
                    return null; // non-power y dependence
                } else {
                    otherFactors.push(f);
                }
            }
            
            const coeff = otherFactors.length === 0 ? { type: 'Number', value: '1' } as CanonicalAST :
                          (otherFactors.length === 1 ? otherFactors[0] : { type: 'Operator', operator: '*', args: otherFactors } as CanonicalAST);
                          
            if (!yPow) {
                // y^0 term => this implies linear y' = ... + Q(x), which isn't standard Bernoulli n!=0, n!=1.
                // But wait, Bernoulli standard is Q(x) y^n. If n=0, it's linear.
                return null;
            } else if (yPow.type === 'Number' && yPow.value === '1') {
                pyTerm = coeff; // this is -P(x)
            } else {
                qynTerm = coeff; // this is Q(x)
                n = yPow;
            }
        }
        
        if (pyTerm && qynTerm && n) {
            const P = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, pyTerm] });
            return { P, Q: this.simplifier.simplify(qynTerm), n };
        }
        
        return null;
    }
    
    // Homogeneous: y' = F(y/x).
    // Test: F(tx, ty) = F(x, y).
    public isHomogeneous(explicitDeriv: CanonicalAST, x: string, y: string): boolean {
        // Substitute x->tx, y->ty
        const tx = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 't_hom' }, { type: 'Symbol', name: x }] } as CanonicalAST;
        const ty = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 't_hom' }, { type: 'Symbol', name: y }] } as CanonicalAST;
        
        let substituted = ASTUtils.replaceNode(explicitDeriv, { type: 'Symbol', name: x }, tx);
        substituted = ASTUtils.replaceNode(substituted, { type: 'Symbol', name: y }, ty);
        
        // simplify F(tx, ty) - F(x,y)
        const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [substituted, explicitDeriv] });
        return diff.type === 'Number' && diff.value === '0';
    }

    private getTerms(node: CanonicalAST): CanonicalAST[] {
        if (node.type === 'Operator' && node.operator === '+') {
            const terms: CanonicalAST[] = [];
            for (const a of node.args) terms.push(...this.getTerms(a));
            return terms;
        }
        if (node.type === 'Operator' && node.operator === '-') {
            const terms: CanonicalAST[] = [...this.getTerms(node.args[0])];
            const negTerms = this.getTerms(node.args[1]).map(t => ({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, t] } as CanonicalAST));
            terms.push(...negTerms);
            return terms;
        }
        return [node];
    }
}
