import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { ExactMatrix, ExactVector, VectorSpaceInfo } from './types';

export class VectorSpaceEngine {
    public static isLinearlyIndependent(vectors: ExactVector[]): boolean {
        if (vectors.length === 0) return true;
        const A = LAMatrix.transpose(vectors); // vectors as columns
        const b = new Array(vectors[0].length).fill({ num: 0n, den: 1n });
        const res = SystemSolver.solve(A, b);
        return res.systemType === 'unique'; // only trivial solution
    }

    public static inSpan(vectors: ExactVector[], target: ExactVector): boolean {
        if (vectors.length === 0) return target.every(v => v.num === 0n);
        const A = LAMatrix.transpose(vectors);
        const res = SystemSolver.solve(A, target);
        return res.systemType !== 'inconsistent';
    }

    public static getBasis(vectors: ExactVector[]): VectorSpaceInfo {
        if (vectors.length === 0) return { basis: [], dimension: 0, isSubspace: true };
        const A = LAMatrix.transpose(vectors); // vectors as columns
        const { pivotColumns } = LAMatrix.rref(A);
        
        const basis = pivotColumns.map(c => vectors[c]);
        return { basis, dimension: basis.length, isSubspace: true };
    }

    public static rowSpace(A: ExactMatrix): VectorSpaceInfo {
        const { rref, rank } = LAMatrix.rref(A);
        const basis = rref.slice(0, rank); // non-zero rows of RREF form basis for row space
        return { basis, dimension: rank, isSubspace: true };
    }

    public static colSpace(A: ExactMatrix): VectorSpaceInfo {
        const { rank, pivotColumns } = LAMatrix.rref(A);
        const basis = pivotColumns.map(c => A.map(row => row[c]));
        return { basis, dimension: rank, isSubspace: true };
    }

    public static nullSpace(A: ExactMatrix): VectorSpaceInfo {
        const n = A[0].length;
        const b = new Array(A.length).fill({ num: 0n, den: 1n });
        const res = SystemSolver.solve(A, b);
        
        if (res.systemType === 'unique') {
            return { basis: [], dimension: 0, isSubspace: true };
        } else if (res.systemType === 'infinitely_many' && res.parametricSolution) {
            return { basis: res.parametricSolution.nullSpaceBasis, dimension: res.parametricSolution.nullSpaceBasis.length, isSubspace: true };
        }
        return { basis: [], dimension: 0, isSubspace: true };
    }
}

