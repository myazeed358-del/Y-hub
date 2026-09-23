import { Rat, Rational } from '../utils/rational';
import { LAMatrix } from '../linear_algebra/matrix';
import { SystemSolver } from '../linear_algebra/system_solver';

export class ExactMatrix {
    public static add(A: Rational[][], B: Rational[][]): Rational[][] {
        return LAMatrix.add(A, B);
    }

    public static subtract(A: Rational[][], B: Rational[][]): Rational[][] {
        return LAMatrix.subtract(A, B);
    }

    public static multiplyScalar(A: Rational[][], s: Rational): Rational[][] {
        return LAMatrix.multiplyScalar(A, s);
    }

    public static multiply(A: Rational[][], B: Rational[][]): Rational[][] {
        return LAMatrix.multiply(A, B);
    }

    public static multiplyVec(A: Rational[][], v: Rational[]): Rational[] {
        return LAMatrix.multiplyVec(A, v);
    }

    public static det2x2(A: Rational[][]): Rational {
        return LAMatrix.det2x2(A);
    }

    public static trace2x2(A: Rational[][]): Rational {
        return LAMatrix.trace2x2(A);
    }

    public static identity(n: number): Rational[][] {
        return LAMatrix.identity(n);
    }

    public static solveLinearSystem(A: Rational[][], b: Rational[]): Rational[] | null {
        const res = SystemSolver.solve(A, b);
        if (res.systemType === 'unique' && res.solution) return res.solution;
        return null;
    }

    public static solveNullspace2x2(A: Rational[][]): Rational[] | null {
        // Solves Ax = 0 for non-trivial x in 2x2.
        if (!Rat.isZero(A[0][0]) || !Rat.isZero(A[0][1])) {
            if (!Rat.isZero(A[0][1])) return [Rat.one, Rat.mul({num: -1n, den: 1n}, Rat.div(A[0][0], A[0][1]))];
            return [Rat.zero, Rat.one];
        }
        if (!Rat.isZero(A[1][0]) || !Rat.isZero(A[1][1])) {
            if (!Rat.isZero(A[1][1])) return [Rat.one, Rat.mul({num: -1n, den: 1n}, Rat.div(A[1][0], A[1][1]))];
            return [Rat.zero, Rat.one];
        }
        // Zero matrix
        return [Rat.one, Rat.zero];
    }
}

