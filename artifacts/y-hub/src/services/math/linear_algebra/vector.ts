import { ExactVector } from './types';
import { Rat, Rational } from '../utils/rational';
import { CanonicalAST } from '../types/ast';

export class VectorEngine {
    public static add(u: ExactVector, v: ExactVector): ExactVector {
        return u.map((val, i) => Rat.add(val, v[i]));
    }

    public static subtract(u: ExactVector, v: ExactVector): ExactVector {
        return u.map((val, i) => Rat.sub(val, v[i]));
    }

    public static scale(u: ExactVector, s: Rational): ExactVector {
        return u.map(val => Rat.mul(val, s));
    }

    public static dot(u: ExactVector, v: ExactVector): Rational {
        let sum = Rat.zero;
        for (let i = 0; i < u.length; i++) {
            sum = Rat.add(sum, Rat.mul(u[i], v[i]));
        }
        return sum;
    }

    public static cross(u: ExactVector, v: ExactVector): ExactVector | null {
        if (u.length !== 3 || v.length !== 3) return null;
        return [
            Rat.sub(Rat.mul(u[1], v[2]), Rat.mul(u[2], v[1])),
            Rat.sub(Rat.mul(u[2], v[0]), Rat.mul(u[0], v[2])),
            Rat.sub(Rat.mul(u[0], v[1]), Rat.mul(u[1], v[0]))
        ];
    }

    public static proj(u: ExactVector, v: ExactVector): ExactVector {
        // proj_v (u) = (u . v) / (v . v) * v
        const uv = this.dot(u, v);
        const vv = this.dot(v, v);
        if (Rat.isZero(vv)) return v.map(() => Rat.zero);
        const scalar = Rat.div(uv, vv);
        return this.scale(v, scalar);
    }

    public static normAST(u: ExactVector): CanonicalAST {
        const dot = this.dot(u, u);
        if (Rat.isZero(dot)) return { type: 'Number', value: '0' };
        
        const sim = Rat.simplify(dot);
        const inner: CanonicalAST = sim.den === 1n ? 
            { type: 'Number', value: sim.num.toString() } :
            { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
            
        return { type: 'Function', name: 'sqrt', args: [inner] };
    }
}

