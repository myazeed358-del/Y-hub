import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { ExactMatrix, ExactVector, EigenStructure } from './types';
import { Rat, Rational } from '../utils/rational';

export class EigenEngine {
    public static compute2x2(A: ExactMatrix): EigenStructure | null {
        if (A.length !== 2 || A[0].length !== 2) return null;

        const tr = LAMatrix.trace(A);
        const det = LAMatrix.determinant(A);
        
        const tr2 = Rat.mul(tr, tr);
        const fourDet = Rat.mul({num: 4n, den: 1n}, det);
        const D = Rat.sub(tr2, fourDet);
        
        const two = {num: 2n, den: 1n};
        
        const struct: EigenStructure = {
            eigenvalues: [],
            eigenvectors: [],
            diagonalizable: false,
            defective: false
        };

        if (D.num > 0n) {
            const exactSqrt = this.getExactSqrt(D);
            if (!exactSqrt) return null; // radical required, skip exact for now
            
            const r1 = Rat.div(Rat.add(tr, exactSqrt), two);
            const r2 = Rat.div(Rat.sub(tr, exactSqrt), two);
            
            struct.eigenvalues.push({ value: r1, algebraicMultiplicity: 1 });
            struct.eigenvalues.push({ value: r2, algebraicMultiplicity: 1 });
            
            const v1 = this.nullSpace2x2(A, r1);
            const v2 = this.nullSpace2x2(A, r2);
            
            if (v1) struct.eigenvectors.push({ value: r1, vector: v1 });
            if (v2) struct.eigenvectors.push({ value: r2, vector: v2 });
            
            struct.diagonalizable = true;
        } else if (D.num === 0n) {
            const r = Rat.div(tr, two);
            struct.eigenvalues.push({ value: r, algebraicMultiplicity: 2 });
            
            const A_minus_rI = LAMatrix.subtract(A, [[r, Rat.zero], [Rat.zero, r]]);
            const isZero = A_minus_rI.every(row => row.every(val => Rat.isZero(val)));
            
            if (isZero) {
                struct.eigenvectors.push({ value: r, vector: [Rat.one, Rat.zero] });
                struct.eigenvectors.push({ value: r, vector: [Rat.zero, Rat.one] });
                struct.diagonalizable = true;
            } else {
                const v = this.nullSpace2x2(A, r);
                if (v) struct.eigenvectors.push({ value: r, vector: v });
                struct.defective = true;
            }
        } else {
            // Complex roots
            const exactBetaSqrt = this.getExactSqrt({ num: -D.num, den: D.den });
            if (!exactBetaSqrt) return null;
            
            const alpha = Rat.div(tr, two);
            const beta = Rat.div(exactBetaSqrt, two);
            
            struct.eigenvalues.push({ value: { real: alpha, imag: beta }, algebraicMultiplicity: 1 });
            struct.eigenvalues.push({ value: { real: alpha, imag: { num: -beta.num, den: beta.den } }, algebraicMultiplicity: 1 });
            struct.diagonalizable = true; // diagonalizable over C
        }

        return struct;
    }

    private static getExactSqrt(r: Rational): Rational | null {
        if (r.num < 0n) return null;
        if (r.num === 0n) return Rat.zero;
        
        const iSqrt = (n: bigint): bigint => {
            if (n < 0n) return -1n;
            if (n === 0n) return 0n;
            let x0 = n / 2n;
            if (x0 !== 0n) {
                let x1 = (x0 + n / x0) / 2n;
                while (x1 < x0) {
                    x0 = x1;
                    x1 = (x0 + n / x0) / 2n;
                }
                return x0;
            }
            return 1n;
        };
        
        const numRoot = iSqrt(r.num);
        if (numRoot * numRoot !== r.num) return null;
        const denRoot = iSqrt(r.den);
        if (denRoot * denRoot !== r.den) return null;
        
        return { num: numRoot, den: denRoot };
    }

    private static nullSpace2x2(A: ExactMatrix, lambda: Rational): ExactVector | null {
        const A_lI = LAMatrix.subtract(A, [[lambda, Rat.zero], [Rat.zero, lambda]]);
        if (!Rat.isZero(A_lI[0][0]) || !Rat.isZero(A_lI[0][1])) {
            if (!Rat.isZero(A_lI[0][1])) return [Rat.one, Rat.mul({num: -1n, den: 1n}, Rat.div(A_lI[0][0], A_lI[0][1]))];
            return [Rat.zero, Rat.one];
        }
        if (!Rat.isZero(A_lI[1][0]) || !Rat.isZero(A_lI[1][1])) {
            if (!Rat.isZero(A_lI[1][1])) return [Rat.one, Rat.mul({num: -1n, den: 1n}, Rat.div(A_lI[1][0], A_lI[1][1]))];
            return [Rat.zero, Rat.one];
        }
        return [Rat.one, Rat.zero]; // Zero matrix case handled elsewhere typically
    }
}

