import { LAMatrix } from './matrix';
import { ExactMatrix, ExactVector, LinearSystemResult } from './types';
import { Rat } from '../utils/rational';

export class SystemSolver {
    public static solve(A: ExactMatrix, b: ExactVector): LinearSystemResult {
        const m = A.length;
        const n = A[0].length;
        
        // Form augmented matrix [A | b]
        const aug = A.map((row, i) => [...row, b[i]]);
        
        const { rref, rank, pivotColumns, freeVariables, steps } = LAMatrix.rref(aug);
        
        // Count rank of A vs rank of [A|b]
        const pivotColsA = pivotColumns.filter(c => c < n);
        const rankA = pivotColsA.length;
        const rankAug = pivotColumns.length; // rref computes pivots across all cols including the augmented one
        
        if (rankAug > rankA) {
            return {
                systemType: 'inconsistent',
                rankA,
                rankAugmented: rankAug,
                freeVariables: [],
                pivotColumns: pivotColsA,
                steps
            };
        }
        
        if (rankA === n) {
            // Unique solution
            const solution = [];
            for (let i = 0; i < n; i++) {
                solution.push(rref[i][n]);
            }
            return {
                systemType: 'unique',
                solution,
                rankA,
                rankAugmented: rankAug,
                freeVariables: [],
                pivotColumns: pivotColsA,
                steps
            };
        }
        
        // Infinitely many solutions
        const freeVarsA = [];
        for (let j = 0; j < n; j++) {
            if (!pivotColsA.includes(j)) freeVarsA.push(j);
        }
        
        const base = new Array(n).fill(Rat.zero);
        const nullSpaceBasis: ExactVector[] = freeVarsA.map(() => new Array(n).fill(Rat.zero));
        
        let rowIdx = 0;
        for (let j = 0; j < n; j++) {
            if (pivotColsA.includes(j)) {
                base[j] = rref[rowIdx][n];
                freeVarsA.forEach((freeJ, freeIdx) => {
                    const val = rref[rowIdx][freeJ];
                    nullSpaceBasis[freeIdx][j] = { num: -val.num, den: val.den };
                });
                rowIdx++;
            } else {
                const freeIdx = freeVarsA.indexOf(j);
                nullSpaceBasis[freeIdx][j] = Rat.one;
            }
        }
        
        return {
            systemType: 'infinitely_many',
            parametricSolution: { base, nullSpaceBasis },
            rankA,
            rankAugmented: rankAug,
            freeVariables: freeVarsA,
            pivotColumns: pivotColsA,
            steps
        };
    }
}

