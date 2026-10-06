import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ODEUtils } from './utils';
import { PolynomialExtractor } from '../symbolic/polynomial';
import { Rat, Rational } from '../utils/rational';
import { UndeterminedCoefficientsEngine } from './undetermined_coefficients';

export class HigherOrderLinearODEEngine {
    private simplifier = new SymbolicSimplifier();
    private utils = new ODEUtils();
    private polyExtractor = new PolynomialExtractor();

    public solve(req: ODERequest): { solutions: ODESolution[], steps: ODEStep[] } | null {
        if (!req.higherDerivatives || req.higherDerivatives.length < 2) return null; // > 2nd order

        const y = req.dependentVariable;
        const x = req.independentVariable;
        const derivs = [req.derivativeVariable, ...req.higherDerivatives];
        
        const linRes = this.utils.isLinearNthOrder(req.equation, y, derivs);
        if (!linRes) return null;
        
        const isHomogeneous = linRes.rhs.type === 'Number' && linRes.rhs.value === '0';

        const coeffs = linRes.coeffs; // a0, a1, ... an
        const n = coeffs.length - 1;

        // Ensure constant coefficients.
        //
        // PolynomialExtractor uses ascending coefficient order:
        // [a0, a1, ..., an] <=> a0 + a1*r + ... + an*r^n.
        const ratCoeffs: Rational[] = [];
        for (let i = 0; i <= n; i++) {
            const a = coeffs[i];

            if (a.type !== 'Number') return null;

            const r = this.parseRat(a.value);
            if (!r) return null;

            ratCoeffs.push(r);
        }

        // Characteristic polynomial:
        // a0 + a1*r + ... + an*r^n = 0.
        const rootsRes = this.polyExtractor.findRationalRootsExact(ratCoeffs);
        const exactRoots = rootsRes.roots;
        const remaining = rootsRes.remainingCoeffs;
        
        const basis: CanonicalAST[] = [];
        
        // Add rational roots
        for (const root of exactRoots) {
            for (let m = 0; m < root.multiplicity; m++) {
                basis.push(this.buildTerm(root.value, m, x));
            }
        }
        
        // If remaining is degree <= 2, we can factor exactly
        if (remaining.length === 3) {
            // Quadratic Ar^2 + Br + C
            const A = remaining[0];
            const B = remaining[1];
            const C = remaining[2];
            
            // D = B^2 - 4AC
            const B2 = Rat.mul(B, B);
            const AC4 = Rat.mul({ num: 4n, den: 1n }, Rat.mul(A, C));
            const D = Rat.sub(B2, AC4);
            const twoA = Rat.mul({ num: 2n, den: 1n }, A);
            
            const signD = D.num * D.den > 0n ? 1 : (D.num === 0n ? 0 : -1);
            if (signD > 0) {
                // Must be a perfect square to be rational, but if not we can't do exact without radicals.
                // We'll just reject it to keep honest unsupported.
                throw new Error('unsupported');
            } else if (signD === 0) {
                const r = Rat.div(Rat.simplify({ num: -B.num, den: B.den }), twoA);
                basis.push(this.buildTerm(r, 0, x));
                basis.push(this.buildTerm(r, 1, x));
            } else {
                // Complex conjugate alpha +- i beta
                const alpha = Rat.div(Rat.simplify({ num: -B.num, den: B.den }), twoA);
                const negD = { num: -D.num, den: D.den };
                const betaSqrt = { type: 'Operator', operator: '^', args: [this.ratToAST(negD), { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
                const beta = { type: 'Operator', operator: '/', args: [betaSqrt, this.ratToAST(twoA)] } as CanonicalAST;
                
                const expPart = this.buildTerm(alpha, 0, x);
                const cosPart = { type: 'Function', name: 'cos', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Symbol', name: x }] }] } as CanonicalAST;
                const sinPart = { type: 'Function', name: 'sin', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Symbol', name: x }] }] } as CanonicalAST;
                
                basis.push({ type: 'Operator', operator: '*', args: [expPart, cosPart] });
                basis.push({ type: 'Operator', operator: '*', args: [expPart, sinPart] });
            }
        } else if (remaining.length > 3) {
            // Cannot factor further exactly.
            throw new Error('unsupported');
        } else if (remaining.length === 2) {
            const A = remaining[0];
            const B = remaining[1];
            if (A.num !== 0n) {
                const r = Rat.div(Rat.simplify({ num: -B.num, den: B.den }), A);
                basis.push(this.buildTerm(r, 0, x));
            }
        }

        if (basis.length !== n) throw new Error('unsupported'); // Safety check

        let finalY: CanonicalAST = { type: 'Number', value: '0' };
        for (let i = 0; i < basis.length; i++) {
            const term = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C' + (i+1) }, basis[i]] } as CanonicalAST;
            if (i === 0) finalY = term;
            else finalY = { type: 'Operator', operator: '+', args: [finalY, term] };
        }

        const steps: ODEStep[] = [];

        if (!isHomogeneous) {
            const ucEngine = new UndeterminedCoefficientsEngine();
            const ucRes = ucEngine.solveParticular(req, linRes.rhs, x, coeffs);
            if (!ucRes) throw new Error('unsupported'); // UC failed, we don't delegate to VoP as per instructions
            
            steps.push(...ucRes.steps);
            finalY = { type: 'Operator', operator: '+', args: [finalY, ucRes.yp] } as CanonicalAST;
        }

        steps.push({
            strategy: isHomogeneous ? 'Higher-Order Linear Homogeneous' : 'Higher-Order Nonhomogeneous',
            inputExpression: req.equation,
            transformation: 'Factored exact characteristic roots and assembled basis',
            resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: this.simplifier.simplify(finalY) }
        });

        const domain = { type: 'Interval', min: -Infinity, max: Infinity, minInclusive: false, maxInclusive: false };

        return {
            solutions: [{
                type: 'explicit',
                equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: this.simplifier.simplify(finalY) },
                domain: domain as any,
                assumptions: []
            }],
            steps
        };
    }

    private buildTerm(root: Rational, m: number, x: string): CanonicalAST {
        let expPart: CanonicalAST;
        if (root.num === 0n) {
            expPart = { type: 'Number', value: '1' };
        } else {
            expPart = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(root), { type: 'Symbol', name: x }] }] };
        }
        if (m === 0) return expPart;
        
        let power: CanonicalAST = { type: 'Symbol', name: x };
        if (m > 1) {
            power = { type: 'Operator', operator: '^', args: [{ type: 'Symbol', name: x }, { type: 'Number', value: m.toString() }] };
        }
        
        if (expPart.type === 'Number' && expPart.value === '1') return power;
        return { type: 'Operator', operator: '*', args: [power, expPart] };
    }

    private ratToAST(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }

    private parseRat(val: string): Rational | null {
        try {
            if (val.includes('/')) {
                const [n, d] = val.split('/');
                return Rat.simplify({ num: BigInt(n), den: BigInt(d) });
            }
            return { num: BigInt(val), den: 1n };
        } catch {
            return null;
        }
    }
}

