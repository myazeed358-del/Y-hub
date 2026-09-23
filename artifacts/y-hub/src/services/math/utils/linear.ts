import { Rational, Rat } from './rational';

export class LinearAlgebra {
  // Solves M * x = b for exact Rationals using Gaussian elimination
  public static solveExact(matrix: Rational[][], vector: Rational[]): Rational[] | null {
    const n = vector.length;
    if (matrix.length !== n) return null;
    
    // Create augmented matrix
    const A: Rational[][] = [];
    for (let i = 0; i < n; i++) {
       A.push([...matrix[i], vector[i]]);
    }
    
    for (let i = 0; i < n; i++) {
       // Find pivot
       let pivot = i;
       for (let j = i + 1; j < n; j++) {
          // just check non-zero
          if (!Rat.isZero(A[j][i])) {
             pivot = j;
             break; // Any non-zero is fine
          }
       }
       if (Rat.isZero(A[pivot][i])) {
          return null; // Singular matrix
       }
       
       // Swap
       const temp = A[i];
       A[i] = A[pivot];
       A[pivot] = temp;
       
       // Normalize pivot row
       const pivotVal = A[i][i];
       for (let j = i; j <= n; j++) {
          A[i][j] = Rat.div(A[i][j], pivotVal);
       }
       
       // Eliminate column i in other rows
       for (let j = 0; j < n; j++) {
          if (i !== j) {
             const factor = A[j][i];
             for (let k = i; k <= n; k++) {
                A[j][k] = Rat.sub(A[j][k], Rat.mul(factor, A[i][k]));
             }
          }
       }
    }
    
    // Extract solution
    const x: Rational[] = [];
    for (let i = 0; i < n; i++) {
       x.push(A[i][n]);
    }
    return x;
  }
}
