import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { VectorEngine } from './vector';
import { ExactMatrix, ExactVector } from './types';
import { CanonicalAST } from '../types/ast';

export class InnerProductEngine {
    public static gramSchmidt(vectors: ExactVector[]): ExactVector[] {
        if (vectors.length === 0) return [];
        const orthogonal: ExactVector[] = [vectors[0]];

        for (let i = 1; i < vectors.length; i++) {
            let u = vectors[i];
            for (let j = 0; j < i; j++) {
                const proj = VectorEngine.proj(vectors[i], orthogonal[j]);
                u = VectorEngine.subtract(u, proj);
            }
            orthogonal.push(u);
        }
        return orthogonal;
    }

    public static leastSquares(A: ExactMatrix, b: ExactVector): { solution: ExactVector, error: CanonicalAST } | null {
        // Normal equations: (A^T A) x = A^T b
        const AT = LAMatrix.transpose(A);
        const ATA = LAMatrix.multiply(AT, A);
        const ATb = LAMatrix.multiplyVec(AT, b);
        
        const res = SystemSolver.solve(ATA, ATb);
        if (res.systemType === 'unique' && res.solution) {
            const Ax = LAMatrix.multiplyVec(A, res.solution);
            const residual = VectorEngine.subtract(b, Ax);
            const err = VectorEngine.normAST(residual);
            return { solution: res.solution, error: err };
        } else if (res.systemType === 'infinitely_many' && res.parametricSolution) {
            // Pick base solution for least squares
            const baseSol = res.parametricSolution.base;
            const Ax = LAMatrix.multiplyVec(A, baseSol);
            const residual = VectorEngine.subtract(b, Ax);
            const err = VectorEngine.normAST(residual);
            return { solution: baseSol, error: err };
        }
        return null;
    }
}

