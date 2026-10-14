


import { Rat, Rational } from '../utils/rational';


/** Exact rational Gaussian elimination for forcing coefficient matching. */
export class CoefficientSystemSolver {
  public solveLinearSystem(A: Rational[][], b: Rational[]): Rational[] | null {
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
}
