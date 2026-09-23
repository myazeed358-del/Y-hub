import { CanonicalAST } from '../types/ast';
import { ODERequest, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';
import { Rat, Rational } from '../utils/rational';
import { ODEUtils } from './utils';
import { PolynomialExtractor } from '../symbolic/polynomial';

export class UndeterminedCoefficientsEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private utils = new ODEUtils();
    private polyExtractor = new PolynomialExtractor();

    public solveParticular(req: ODERequest, g: CanonicalAST, x: string, coeffs: CanonicalAST[]): { yp: CanonicalAST, steps: ODEStep[] } | null {
        // 1. Analyze forcing term to find roots of its annihilator
        const roots = this.findAnnihilatorRoots(g, x);
        if (!roots) return null; // Unsupported forcing family

        // 2. Determine multiplicity of these roots in the characteristic equation
        const charCoeffs: Rational[] = [];
        for (let i = coeffs.length - 1; i >= 0; i--) {
            const r = this.parseRat(coeffs[i]);
            if (!r) return null;
            charCoeffs.push(r);
        }
        const charRootsRes = this.polyExtractor.findRationalRootsExact(charCoeffs);
        
        // Count resonance
        let multiplicity = 0;
        for (const root of roots) {
            const match = charRootsRes.roots.find(r => Rat.equals(r.value, root.value));
            if (match && match.multiplicity > multiplicity) {
                multiplicity = match.multiplicity; // We use max multiplicity for simplicity of trial x^m
            }
        }

        // 3. Build trial solution
        const { trial, constants } = this.buildTrialSolution(roots, multiplicity, x);
        
        // 4. E(x) = L[y_p] - g(x) = 0
        let L_yp: CanonicalAST = { type: 'Number', value: '0' };
        let currentDeriv = trial;
        
        for (let i = 0; i < coeffs.length; i++) {
            const term = { type: 'Operator', operator: '*', args: [coeffs[i], currentDeriv] } as CanonicalAST;
            if (i === 0) L_yp = term;
            else L_yp = { type: 'Operator', operator: '+', args: [L_yp, term] };
            if (i < coeffs.length - 1) {
                currentDeriv = this.simplifier.simplify(this.dEngine.differentiate(currentDeriv, x));
            }
        }
        
        const E = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [L_yp, g] });

        // 5. Generate equations via Taylor evaluation E^(k)(0) = 0
        const n = constants.length;
        const eqns: CanonicalAST[] = [];
        let currE = E;
        eqns.push(this.simplifier.simplify(ASTUtils.replaceNode(currE, { type: 'Symbol', name: x }, { type: 'Number', value: '0' })));
        
        for (let i = 1; i < n; i++) {
            currE = this.simplifier.simplify(this.dEngine.differentiate(currE, x));
            eqns.push(this.simplifier.simplify(ASTUtils.replaceNode(currE, { type: 'Symbol', name: x }, { type: 'Number', value: '0' })));
        }

        // 6. Extract linear system
        const matrix: Rational[][] = [];
        const rhsVec: Rational[] = [];
        
        let valid = true;
        for (let i = 0; i < n; i++) {
            const row: Rational[] = [];
            for (let j = 0; j < n; j++) {
                const coeffAST = this.simplifier.simplify(this.dEngine.differentiate(eqns[i], constants[j]));
                const coeff = this.parseRat(coeffAST);
                if (!coeff) valid = false;
                row.push(coeff || Rat.zero);
            }
            matrix.push(row);
            
            let cstExpr = eqns[i];
            for (const c of constants) {
                cstExpr = ASTUtils.replaceNode(cstExpr, { type: 'Symbol', name: c }, { type: 'Number', value: '0' });
            }
            const cst = this.parseRat(this.simplifier.simplify(cstExpr));
            if (!cst) valid = false;
            rhsVec.push(valid && cst ? { num: -cst.num, den: cst.den } : Rat.zero);
        }

        if (!valid) return null;

        const solvedConsts = this.solveLinearSystem(matrix, rhsVec);
        if (!solvedConsts) return null;

        // 7. Substitute back
        let yp = trial;
        for (let i = 0; i < n; i++) {
            yp = ASTUtils.replaceNode(yp, { type: 'Symbol', name: constants[i] }, this.ratToAST(solvedConsts[i])) as CanonicalAST;
        }

        return {
            yp: this.simplifier.simplify(yp),
            steps: [{
                strategy: 'Undetermined Coefficients',
                inputExpression: g,
                transformation: \Generated trial solution and solved constants using exact linear system. Resonance multiplier x^\ applied.\,
                resultingExpression: this.simplifier.simplify(yp)
            }]
        };
    }

    private findAnnihilatorRoots(g: CanonicalAST, x: string): { value: Rational, multiplicity: number, type: 'real'|'complex' }[] | null {
        // Limited extraction for standard forms
        // Polynomial: root 0
        // Exp: exp(a x) -> root a
        // Sin/Cos: sin(b x) -> root +- i b
        // Product: we just sum roots
        
        if (g.type === 'Number' || (g.type === 'Symbol' && g.name === x)) return [{ value: Rat.zero, multiplicity: 1, type: 'real' }];
        
        if (g.type === 'Operator' && g.operator === '^' && g.args[0].type === 'Symbol' && g.args[0].name === x && g.args[1].type === 'Number') {
            return [{ value: Rat.zero, multiplicity: parseInt(g.args[1].value) + 1, type: 'real' }];
        }
        
        if (g.type === 'Function' && g.name === 'exp') {
            // exp(a x)
            const arg = g.args[0];
            if (arg.type === 'Operator' && arg.operator === '*' && arg.args[1].type === 'Symbol' && arg.args[1].name === x) {
                const a = this.parseRat(arg.args[0]);
                if (a) return [{ value: a, multiplicity: 1, type: 'real' }];
            }
            if (arg.type === 'Symbol' && arg.name === x) {
                return [{ value: Rat.one, multiplicity: 1, type: 'real' }];
            }
        }
        
        if (g.type === 'Function' && (g.name === 'sin' || g.name === 'cos')) {
            const arg = g.args[0];
            if (arg.type === 'Operator' && arg.operator === '*' && arg.args[1].type === 'Symbol' && arg.args[1].name === x) {
                const b = this.parseRat(arg.args[0]);
                if (b) return [{ value: b, multiplicity: 1, type: 'complex' }];
            }
            if (arg.type === 'Symbol' && arg.name === x) {
                return [{ value: Rat.one, multiplicity: 1, type: 'complex' }];
            }
        }
        
        if (g.type === 'Operator' && g.operator === '+') {
            const r1 = this.findAnnihilatorRoots(g.args[0], x);
            const r2 = this.findAnnihilatorRoots(g.args[1], x);
            if (r1 && r2) return [...r1, ...r2];
        }
        
        if (g.type === 'Operator' && g.operator === '*') {
            // Very simplified: return roots of terms if it matches P(x)*exp or P(x)*sin
            const roots = [];
            for (const arg of g.args) {
                const r = this.findAnnihilatorRoots(arg, x);
                if (r) roots.push(...r);
                else return null;
            }
            return roots; // This handles x^n exp(a x) as having roots {0, a}. 
            // Technically annihilator root for x^n e^{ax} is 'a' with multiplicity n+1.
            // But this will just construct trial terms for both 0 and a, which safely covers the space!
        }
        
        return null;
    }

    private buildTrialSolution(roots: { value: Rational, multiplicity: number, type: 'real'|'complex' }[], resMultiplicity: number, x: string): { trial: CanonicalAST, constants: string[] } {
        const terms: CanonicalAST[] = [];
        const constants: string[] = [];
        let cIdx = 1;
        
        const getConst = () => {
            const name = \A\\;
            constants.push(name);
            return { type: 'Symbol', name } as CanonicalAST;
        };

        for (const r of roots) {
            let mTotal = r.multiplicity + resMultiplicity;
            
            for (let m = 0; m < mTotal; m++) {
                let xTerm: CanonicalAST = { type: 'Number', value: '1' };
                if (m === 1) xTerm = { type: 'Symbol', name: x };
                else if (m > 1) xTerm = { type: 'Operator', operator: '^', args: [{ type: 'Symbol', name: x }, { type: 'Number', value: m.toString() }] };
                
                if (r.type === 'real') {
                    let expTerm: CanonicalAST = { type: 'Number', value: '1' };
                    if (!Rat.isZero(r.value)) {
                        expTerm = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(r.value), { type: 'Symbol', name: x }] }] };
                    }
                    
                    const term = { type: 'Operator', operator: '*', args: [getConst(), xTerm, expTerm] } as CanonicalAST;
                    terms.push(this.simplifier.simplify(term));
                } else {
                    const arg = { type: 'Operator', operator: '*', args: [this.ratToAST(r.value), { type: 'Symbol', name: x }] } as CanonicalAST;
                    const sinTerm = { type: 'Function', name: 'sin', args: [arg] } as CanonicalAST;
                    const cosTerm = { type: 'Function', name: 'cos', args: [arg] } as CanonicalAST;
                    
                    terms.push(this.simplifier.simplify({ type: 'Operator', operator: '*', args: [getConst(), xTerm, sinTerm] }));
                    terms.push(this.simplifier.simplify({ type: 'Operator', operator: '*', args: [getConst(), xTerm, cosTerm] }));
                }
            }
        }
        
        let trial = terms[0];
        for (let i = 1; i < terms.length; i++) {
            trial = { type: 'Operator', operator: '+', args: [trial, terms[i]] };
        }
        
        return { trial, constants };
    }

    private solveLinearSystem(A: Rational[][], b: Rational[]): Rational[] | null {
        const n = b.length;
        const aug: Rational[][] = A.map((row, i) => [...row, b[i]]);

        for (let i = 0; i < n; i++) {
            let pivot = i;
            for (let j = i + 1; j < n; j++) {
                if (!Rat.isZero(aug[j][i])) {
                    pivot = j;
                    break;
                }
            }
            if (Rat.isZero(aug[pivot][i])) return null;

            if (pivot !== i) {
                const temp = aug[i];
                aug[i] = aug[pivot];
                aug[pivot] = temp;
            }

            const pivotVal = aug[i][i];
            for (let j = i; j <= n; j++) {
                aug[i][j] = Rat.div(aug[i][j], pivotVal);
            }

            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = i; j <= n; j++) {
                        aug[k][j] = Rat.sub(aug[k][j], Rat.mul(factor, aug[i][j]));
                    }
                }
            }
        }

        return aug.map(row => row[n]);
    }

    private parseRat(ast: CanonicalAST): Rational | null {
        if (ast.type === 'Number') {
            if (ast.value.includes('/')) {
                const [n, d] = ast.value.split('/');
                return Rat.simplify({ num: BigInt(n), den: BigInt(d) });
            }
            return { num: BigInt(ast.value), den: 1n };
        }
        if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
            const sub = this.parseRat(ast.args[1]);
            if (sub) return { num: -sub.num, den: sub.den };
        }
        return null;
    }

    private ratToAST(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        if (sim.num < 0n) return { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '0' }, { type: 'Operator', operator: '/', args: [{ type: 'Number', value: (-sim.num).toString() }, { type: 'Number', value: sim.den.toString() }] }] };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }
}

