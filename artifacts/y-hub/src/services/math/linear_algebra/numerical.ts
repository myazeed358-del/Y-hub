export class NumericalLAEngine {
    public static powerMethod(A: number[][], x0: number[], iterations: number, tol: number): { eigenvalue: number, eigenvector: number[], status: string } {
        const n = A.length;
        let x = [...x0];
        let lambda = 0;
        
        for (let iter = 0; iter < iterations; iter++) {
            let nextX = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    nextX[i] += A[i][j] * x[j];
                }
            }
            
            // max norm
            let maxVal = 0;
            for (let i = 0; i < n; i++) {
                if (Math.abs(nextX[i]) > Math.abs(maxVal)) maxVal = nextX[i];
            }
            
            if (maxVal === 0) return { eigenvalue: 0, eigenvector: x, status: 'completed' };
            
            for (let i = 0; i < n; i++) nextX[i] /= maxVal;
            
            if (Math.abs(maxVal - lambda) < tol) {
                return { eigenvalue: maxVal, eigenvector: nextX, status: 'tolerance_met' };
            }
            
            x = nextX;
            lambda = maxVal;
            
            if (!isFinite(lambda)) return { eigenvalue: NaN, eigenvector: [], status: 'non_finite_evaluation' };
        }
        return { eigenvalue: lambda, eigenvector: x, status: 'tolerance_not_met' };
    }

    public static luDecomposition(A: number[][]): { L: number[][], U: number[][], status: string } {
        const n = A.length;
        const L = Array.from({length: n}, () => new Array(n).fill(0));
        const U = Array.from({length: n}, () => new Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let k = i; k < n; k++) {
                let sum = 0;
                for (let j = 0; j < i; j++) sum += (L[i][j] * U[j][k]);
                U[i][k] = A[i][k] - sum;
            }

            for (let k = i; k < n; k++) {
                if (i === k) L[i][i] = 1;
                else {
                    let sum = 0;
                    for (let j = 0; j < i; j++) sum += (L[k][j] * U[j][i]);
                    if (U[i][i] === 0) return { L, U, status: 'singular' };
                    L[k][i] = (A[k][i] - sum) / U[i][i];
                }
            }
        }
        return { L, U, status: 'completed' };
    }
}

