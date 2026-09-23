import { Rat, Rational } from '../utils/rational';
import { ExactMatrix, ExactVector, RowOperation } from './types';

export class LAMatrix {
    public static add(A: ExactMatrix, B: ExactMatrix): ExactMatrix {
        return A.map((row, i) => row.map((val, j) => Rat.add(val, B[i][j])));
    }

    public static subtract(A: ExactMatrix, B: ExactMatrix): ExactMatrix {
        return A.map((row, i) => row.map((val, j) => Rat.sub(val, B[i][j])));
    }

    public static multiplyScalar(A: ExactMatrix, s: Rational): ExactMatrix {
        return A.map(row => row.map(val => Rat.mul(val, s)));
    }

    public static multiply(A: ExactMatrix, B: ExactMatrix): ExactMatrix {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        const res: ExactMatrix = [];
        for (let i = 0; i < rowsA; i++) {
            res[i] = [];
            for (let j = 0; j < colsB; j++) {
                let sum = Rat.zero;
                for (let k = 0; k < colsA; k++) {
                    sum = Rat.add(sum, Rat.mul(A[i][k], B[k][j]));
                }
                res[i][j] = sum;
            }
        }
        return res;
    }

    public static multiplyVec(A: ExactMatrix, v: ExactVector): ExactVector {
        return this.multiply(A, v.map(val => [val])).map(row => row[0]);
    }

    public static transpose(A: ExactMatrix): ExactMatrix {
        const res: ExactMatrix = [];
        for (let i = 0; i < A[0].length; i++) {
            res[i] = [];
            for (let j = 0; j < A.length; j++) {
                res[i][j] = A[j][i];
            }
        }
        return res;
    }

    public static identity(n: number): ExactMatrix {
        const res: ExactMatrix = [];
        for (let i = 0; i < n; i++) {
            const row: ExactVector = [];
            for (let j = 0; j < n; j++) {
                row.push(i === j ? Rat.one : Rat.zero);
            }
            res.push(row);
        }
        return res;
    }

    public static rref(A: ExactMatrix): { rref: ExactMatrix, rank: number, pivotColumns: number[], freeVariables: number[], steps: any[] } {
        const m = A.length;
        const n = A[0].length;
        const matrix = A.map(row => [...row]);
        let r = 0;
        const pivotColumns: number[] = [];
        const steps: any[] = [];

        for (let c = 0; c < n && r < m; c++) {
            let pivotRow = r;
            while (pivotRow < m && Rat.isZero(matrix[pivotRow][c])) {
                pivotRow++;
            }
            if (pivotRow === m) continue;

            if (pivotRow !== r) {
                const temp = matrix[r];
                matrix[r] = matrix[pivotRow];
                matrix[pivotRow] = temp;
                steps.push({ type: 'swap', row1: r, row2: pivotRow });
            }

            const pivotVal = matrix[r][c];
            if (!Rat.isZero(pivotVal) && (pivotVal.num !== 1n || pivotVal.den !== 1n)) {
                const invPivot = Rat.div(Rat.one, pivotVal);
                for (let j = c; j < n; j++) {
                    matrix[r][j] = Rat.mul(matrix[r][j], invPivot);
                }
                steps.push({ type: 'scale', row1: r, scalar: invPivot });
            }

            for (let i = 0; i < m; i++) {
                if (i !== r && !Rat.isZero(matrix[i][c])) {
                    const factor = matrix[i][c];
                    for (let j = c; j < n; j++) {
                        matrix[i][j] = Rat.sub(matrix[i][j], Rat.mul(factor, matrix[r][j]));
                    }
                    steps.push({ type: 'add_multiple', row1: i, row2: r, scalar: { num: -factor.num, den: factor.den } });
                }
            }
            pivotColumns.push(c);
            r++;
        }

        const freeVariables = [];
        for (let c = 0; c < n; c++) {
            if (!pivotColumns.includes(c)) freeVariables.push(c);
        }

        return { rref: matrix, rank: r, pivotColumns, freeVariables, steps };
    }

    public static trace(A: ExactMatrix): Rational {
        const n = A.length;
        let sum = Rat.zero;
        for (let i = 0; i < n; i++) {
            sum = Rat.add(sum, A[i][i]);
        }
        return sum;
    }

    public static trace2x2(A: ExactMatrix): Rational {
        return this.trace(A);
    }

    public static det2x2(A: ExactMatrix): Rational {
        return Rat.sub(Rat.mul(A[0][0], A[1][1]), Rat.mul(A[0][1], A[1][0]));
    }

    public static determinant(A: ExactMatrix): Rational {
        const m = A.length;
        if (m !== A[0].length) throw new Error('invalid_input');
        
        let det = Rat.one;
        const matrix = A.map(row => [...row]);
        
        for (let i = 0; i < m; i++) {
            let pivot = i;
            while (pivot < m && Rat.isZero(matrix[pivot][i])) {
                pivot++;
            }
            if (pivot === m) return Rat.zero;

            if (pivot !== i) {
                const temp = matrix[i];
                matrix[i] = matrix[pivot];
                matrix[pivot] = temp;
                det = Rat.mul(det, { num: -1n, den: 1n });
            }

            const pivotVal = matrix[i][i];
            det = Rat.mul(det, pivotVal);

            for (let j = i + 1; j < m; j++) {
                if (!Rat.isZero(matrix[j][i])) {
                    const factor = Rat.div(matrix[j][i], pivotVal);
                    for (let k = i; k < m; k++) {
                        matrix[j][k] = Rat.sub(matrix[j][k], Rat.mul(factor, matrix[i][k]));
                    }
                }
            }
        }
        return det;
    }

    public static inverse(A: ExactMatrix): ExactMatrix | null {
        const m = A.length;
        if (m !== A[0].length) return null;

        const aug = A.map((row, i) => {
            const newRow = [...row];
            for (let j = 0; j < m; j++) {
                newRow.push(i === j ? Rat.one : Rat.zero);
            }
            return newRow;
        });

        const { rref, rank } = this.rref(aug);
        if (rank < m) return null;

        return rref.map(row => row.slice(m));
    }
}


