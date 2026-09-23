import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution } from '../types/ode';
import { EquationEngine } from '../symbolic/equation';
import { ASTUtils } from '../symbolic/utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { Rat, Rational } from '../utils/rational';

export class IVPEngine {
    private eqEngine = new EquationEngine();
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();

    public solveIVP(req: ODERequest, solutions: ODESolution[]): { particularSolution?: ODESolution, validity: 'established' | 'incompatible' | 'unsupported' } {
        if (!req.initialCondition) return { validity: 'unsupported' };
        
        const x = req.independentVariable;
        const y = req.dependentVariable;
        const x0 = req.initialCondition.x0;
        const y0 = req.initialCondition.y0;
        const higherDerivs = req.initialCondition.derivatives || [];
        const n = 1 + higherDerivs.length;

        for (const sol of solutions) {
            if (sol.type === 'explicit') {
                if (n === 1) {
                    let eq = sol.equation;
                    eq = ASTUtils.replaceNode(eq, { type: 'Symbol', name: x }, x0) as CanonicalAST;
                    eq = ASTUtils.replaceNode(eq, { type: 'Symbol', name: y }, y0) as CanonicalAST;
                    
                    const cSols = this.eqEngine.solveEquation(eq, 'C');
                    const validC = cSols.find(s => s.status === 'exact' && s.value);
                    
                    if (validC && validC.value) {
                        const particularEq = ASTUtils.replaceNode(sol.equation, { type: 'Symbol', name: 'C' }, validC.value) as CanonicalAST;
                        return {
                            particularSolution: { type: 'particular', equation: this.simplifier.simplify(particularEq), domain: sol.domain, assumptions: sol.assumptions },
                            validity: 'established'
                        };
                    }
                } else {
                    // N-th order system
                    const cNames = Array.from({ length: n }, (_, i) => \C\\);
                    
                    const f_x = sol.equation.rhs;
                    const eqns: CanonicalAST[] = [];
                    let currDeriv = f_x;
                    eqns.push(this.simplifier.simplify(ASTUtils.replaceNode(currDeriv, { type: 'Symbol', name: x }, x0)));
                    
                    for (let i = 1; i < n; i++) {
                        currDeriv = this.simplifier.simplify(this.dEngine.differentiate(currDeriv, x));
                        eqns.push(this.simplifier.simplify(ASTUtils.replaceNode(currDeriv, { type: 'Symbol', name: x }, x0)));
                    }

                    const extractCoeff = (expr: CanonicalAST, cName: string): Rational | null => {
                        try { 
                            const cExpr = this.simplifier.simplify(this.dEngine.differentiate(expr, cName));
                            return this.parseRat(cExpr);
                        } catch { return { num: 0n, den: 1n }; }
                    };

                    const extractConst = (expr: CanonicalAST): Rational | null => {
                        let e = expr;
                        for (const cName of cNames) {
                            e = ASTUtils.replaceNode(e, { type: 'Symbol', name: cName }, { type: 'Number', value: '0' });
                        }
                        return this.parseRat(this.simplifier.simplify(e));
                    };

                    const matrix: Rational[][] = [];
                    const rhsVec: Rational[] = [];
                    
                    const targets = [y0, ...higherDerivs];

                    let valid = true;
                    for (let i = 0; i < n; i++) {
                        const row: Rational[] = [];
                        for (let j = 0; j < n; j++) {
                            const coeff = extractCoeff(eqns[i], cNames[j]);
                            if (!coeff) valid = false;
                            row.push(coeff || Rat.zero);
                        }
                        matrix.push(row);
                        
                        const cst = extractConst(eqns[i]);
                        const tgt = this.parseRat(targets[i]);
                        if (!cst || !tgt) valid = false;
                        rhsVec.push(valid && cst && tgt ? Rat.sub(tgt, cst) : Rat.zero);
                    }

                    if (!valid) continue; // Try next solution if any

                    const constants = this.solveLinearSystem(matrix, rhsVec);
                    if (constants) {
                        let particularEq = sol.equation;
                        for (let i = 0; i < n; i++) {
                            const cstAST = this.ratToAST(constants[i]);
                            particularEq = ASTUtils.replaceNode(particularEq, { type: 'Symbol', name: cNames[i] }, cstAST) as CanonicalAST;
                        }
                        
                        return {
                            particularSolution: { type: 'particular', equation: this.simplifier.simplify(particularEq as CanonicalAST), domain: sol.domain, assumptions: sol.assumptions },
                            validity: 'established'
                        };
                    }
                }
            } else if (sol.type === 'implicit' && n === 1) {
                let eq = sol.equation;
                eq = ASTUtils.replaceNode(eq, { type: 'Symbol', name: x }, x0) as CanonicalAST;
                eq = ASTUtils.replaceNode(eq, { type: 'Symbol', name: y }, y0) as CanonicalAST;
                
                const cSols = this.eqEngine.solveEquation(eq, 'C');
                const validC = cSols.find(s => s.status === 'exact' && s.value);
                
                if (validC && validC.value) {
                    const particularEq = ASTUtils.replaceNode(sol.equation, { type: 'Symbol', name: 'C' }, validC.value) as CanonicalAST;
                    return {
                        particularSolution: { type: 'particular', equation: this.simplifier.simplify(particularEq), domain: sol.domain, assumptions: sol.assumptions },
                        validity: 'established'
                    };
                }
            } else if (sol.type === 'equilibrium' && n === 1) {
                const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [y0, sol.equation.rhs] });
                if (diff.type === 'Number' && diff.value === '0') {
                    return { particularSolution: sol, validity: 'established' };
                }
            }
        }

        return { validity: 'incompatible' };
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
            if (Rat.isZero(aug[pivot][i])) return null; // singular

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
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }
}

