import { ExactMatrix, ExactVector } from './types';


import { Rat, Rational } from '../utils/rational';
import { CanonicalAST } from '../types/ast';


/** Exact AST-to-rational conversion shared by linear-algebra operations. */
export class LinearAlgebraAstCodec {
public parseMatrix(m: CanonicalAST[][]): ExactMatrix {
        return m.map(row => row.map(cell => this.parseRat(cell)));
    }

public parseVector(v: CanonicalAST[]): ExactVector {
        return v.map(cell => this.parseRat(cell));
    }

public parseRat(ast: CanonicalAST): Rational {
        if (ast.type === 'Number') {
            if (ast.value.includes('/')) {
                const [n, d] = ast.value.split('/');

                return Rat.div(
                    Rat.fromString(n),
                    Rat.fromString(d)
                );
            }

            return Rat.fromString(ast.value);
        }
        if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
            const sub = this.parseRat(ast.args[1]);
            return { num: -sub.num, den: sub.den };
        }
        throw new Error('Non-constant elements not supported yet in exact linear algebra matrix values');
    }

public astMatrix(m: ExactMatrix): CanonicalAST[][] {
        return m.map(row => row.map(val => this.astRat(val)));
    }

public astVector(v: ExactVector): CanonicalAST[] {
        return v.map(val => this.astRat(val));
    }

public astRat(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        if (sim.num < 0n) return { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '0' }, { type: 'Operator', operator: '/', args: [{ type: 'Number', value: (-sim.num).toString() }, { type: 'Number', value: sim.den.toString() }] }] };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }

public numMatrix(m: ExactMatrix): number[][] {
        return m.map(row => row.map(v => Number(v.num) / Number(v.den)));
    }

public numVector(v: ExactVector): number[] {
        return v.map(v => Number(v.num) / Number(v.den));
    }
}
