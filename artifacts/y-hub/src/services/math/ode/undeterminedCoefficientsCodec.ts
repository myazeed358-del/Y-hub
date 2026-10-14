import { CanonicalAST } from '../types/ast';


import { Rat, Rational } from '../utils/rational';


/** Exact coefficient AST-to-rational mapping. */
export class UndeterminedCoefficientsCodec {
  public parseRat(ast: CanonicalAST): Rational | null {
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

  public ratToAST(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        if (sim.num < 0n) return { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '0' }, { type: 'Operator', operator: '/', args: [{ type: 'Number', value: (-sim.num).toString() }, { type: 'Number', value: sim.den.toString() }] }] };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }
}
