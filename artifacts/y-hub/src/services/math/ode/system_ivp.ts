import { CanonicalAST } from '../types/ast';
import { SystemODERequest, SystemODESolution } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DerivativeEngine } from '../symbolic/derivative';
import { Rat, Rational } from '../utils/rational';
import { ExactMatrix } from './matrix';

export class SystemIVPEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();

    public solve(req: SystemODERequest, solutions: SystemODESolution[]): { particularSolution?: SystemODESolution, validity: 'established' | 'incompatible' | 'existence_not_established' | 'uniqueness_not_established' } {
        if (!req.initialCondition) return { validity: 'incompatible' };

        const { t0, X0 } = req.initialCondition;
        const tVar = req.independentVariable;
        const n = req.dependentVariables.length;
        
        if (X0.length !== n) return { validity: 'incompatible' };

        for (const sol of solutions) {
            if (sol.type === 'explicit') {
                const cNames = Array.from({ length: n }, (_, i) => `C${i + 1}`);
                const matrix: Rational[][] = [];
                const rhsVec: Rational[] = [];
                
                let valid = true;
                
                for (let i = 0; i < n; i++) {
                    const eqRhs = sol.equations[i].type === 'Equation' ? (sol.equations[i] as any).rhs : sol.equations[i];
                    const evalRhs = this.simplifier.simplify(ASTUtils.replaceNode(eqRhs, { type: 'Symbol', name: tVar }, t0));
                    
                    const row: Rational[] = [];
                    for (let j = 0; j < n; j++) {
                        const coeffAst = this.simplifier.simplify(this.dEngine.differentiate(evalRhs, cNames[j]));
                        const coeff = this.parseRat(coeffAst);
                        if (!coeff) valid = false;
                        row.push(coeff || Rat.zero);
                    }
                    matrix.push(row);
                    
                    let constAst = evalRhs;
                    for (const cn of cNames) {
                        constAst = ASTUtils.replaceNode(constAst, { type: 'Symbol', name: cn }, { type: 'Number', value: '0' });
                    }
                    const cst = this.parseRat(this.simplifier.simplify(constAst));
                    const tgt = this.parseRat(X0[i]);
                    
                    if (!cst || !tgt) valid = false;
                    rhsVec.push(valid && cst && tgt ? Rat.sub(tgt, cst) : Rat.zero);
                }
                
                if (!valid) continue;
                
                const constants = ExactMatrix.solveLinearSystem(matrix, rhsVec);
                if (constants) {
                    const newEqs: CanonicalAST[] = [];
                    for (let i = 0; i < n; i++) {
                        let eq = sol.equations[i];
                        for (let j = 0; j < n; j++) {
                            eq = ASTUtils.replaceNode(eq, { type: 'Symbol', name: cNames[j] }, this.ratToAST(constants[j])) as CanonicalAST;
                        }
                        newEqs.push(this.simplifier.simplify(eq));
                    }
                    
                    return {
                        particularSolution: {
                            type: 'particular',
                            equations: newEqs,
                            domain: sol.domain,
                            assumptions: sol.assumptions
                        },
                        validity: 'established'
                    };
                }
            }
        }
        
        return { validity: 'incompatible' };
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

