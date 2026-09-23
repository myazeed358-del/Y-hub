import { LAMatrix } from './matrix';
import { ExactMatrix } from './types';
import { Rat } from '../utils/rational';

export class QuadraticFormEngine {
    public static classify(A: ExactMatrix): 'positive_definite' | 'negative_definite' | 'positive_semidefinite' | 'negative_semidefinite' | 'indefinite' | 'unsupported' {
        // Assume A is symmetric
        const n = A.length;
        
        let allPos = true;
        let allNeg = true;
        let semiPos = true;
        let semiNeg = true;

        for (let k = 1; k <= n; k++) {
            const subMatrix = A.slice(0, k).map(row => row.slice(0, k));
            const det = LAMatrix.determinant(subMatrix);
            
            if (det.num <= 0n) allPos = false;
            if (det.num < 0n) semiPos = false;
            
            if (k % 2 === 1) {
                if (det.num >= 0n) allNeg = false;
                if (det.num > 0n) semiNeg = false;
            } else {
                if (det.num <= 0n) allNeg = false;
                if (det.num < 0n) semiNeg = false;
            }
        }

        if (allPos) return 'positive_definite';
        if (allNeg) return 'negative_definite';
        if (semiPos) return 'positive_semidefinite';
        if (semiNeg) return 'negative_semidefinite';
        return 'indefinite';
    }
}

