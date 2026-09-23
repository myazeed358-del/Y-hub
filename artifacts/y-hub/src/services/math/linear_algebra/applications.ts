import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { ExactMatrix, ExactVector } from './types';
import { Rat, Rational } from '../utils/rational';

export class LAApplications {
    public static leontief(A: ExactMatrix, d: ExactVector): ExactVector | null {
        // (I - A) x = d
        const n = A.length;
        const I = LAMatrix.identity(n);
        const I_minus_A = LAMatrix.subtract(I, A);
        
        const res = SystemSolver.solve(I_minus_A, d);
        if (res.systemType === 'unique' && res.solution) return res.solution;
        return null;
    }

    public static polynomialInterpolation(points: {x: Rational, y: Rational}[]): ExactVector | null {
        const n = points.length;
        const A: ExactMatrix = [];
        const b: ExactVector = [];

        for (let i = 0; i < n; i++) {
            const row: ExactVector = [];
            let currentX = { num: 1n, den: 1n };
            for (let j = 0; j < n; j++) {
                row.push(currentX);
                currentX = Rat.mul(currentX, points[i].x);
            }
            A.push(row);
            b.push(points[i].y);
        }

        const res = SystemSolver.solve(A, b);
        if (res.systemType === 'unique' && res.solution) return res.solution;
        return null;
    }

    public static markovSteadyState(P: ExactMatrix): ExactVector | null {
        // P x = x => (P - I) x = 0 with sum(x) = 1
        const n = P.length;
        const I = LAMatrix.identity(n);
        const P_minus_I = LAMatrix.subtract(P, I);
        
        const aug = P_minus_I.map(row => [...row, Rat.zero]);
        aug.push(new Array(n).fill(Rat.one).concat([Rat.one])); // sum(x_i) = 1
        
        // This is an (n+1) x n system
        const A = aug.map(row => row.slice(0, n));
        const b = aug.map(row => row[n]);
        
        const res = SystemSolver.solve(A, b);
        if (res.systemType === 'unique' && res.solution) {
            return res.solution;
        } else if (res.systemType === 'infinitely_many' && res.parametricSolution) {
            // Pick a solution that sums to 1 (if base satisfies it)
            return res.parametricSolution.base; 
        }
        return null;
    }

    public static graphPaths(adjacency: ExactMatrix, k: number): ExactMatrix {
        let res = LAMatrix.identity(adjacency.length);
        for (let i = 0; i < k; i++) {
            res = LAMatrix.multiply(res, adjacency);
        }
        return res;
    }
}

