import { FuzzyRelationData, RelationPropertyReport, RelationClosureResult } from './types';

export class FuzzyRelation {
  public rows: number;
  public cols: number;

  constructor(public matrix: number[][]) {
    this.rows = matrix.length;
    this.cols = matrix[0]?.length || 0;
    this.validate();
  }

  private validate() {
    if (this.rows === 0 || this.cols === 0) {
      throw new Error('FuzzyRelation must have non-empty dimensions.');
    }
    for (let i = 0; i < this.rows; i++) {
      if (this.matrix[i].length !== this.cols) {
        throw new Error('FuzzyRelation matrix must be rectangular.');
      }
      for (let j = 0; j < this.cols; j++) {
        const v = this.matrix[i][j];
        if (v < 0 || v > 1 || !Number.isFinite(v)) {
          throw new Error('FuzzyRelation memberships must be finite values in [0, 1].');
        }
      }
    }
  }

  public inverse(): FuzzyRelation {
    const inv: number[][] = Array.from({ length: this.cols }, () => new Array(this.rows).fill(0));
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        inv[j][i] = this.matrix[i][j];
      }
    }
    return new FuzzyRelation(inv);
  }

  public static compose(A: FuzzyRelation, B: FuzzyRelation, type: 'max-min' | 'max-product' = 'max-min'): FuzzyRelation {
    if (A.cols !== B.rows) {
      throw new Error('Dimension mismatch for composition.');
    }
    const res: number[][] = Array.from({ length: A.rows }, () => new Array(B.cols).fill(0));
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < B.cols; j++) {
        let maxVal = 0;
        for (let k = 0; k < A.cols; k++) {
          const val = type === 'max-min' 
            ? Math.min(A.matrix[i][k], B.matrix[k][j])
            : A.matrix[i][k] * B.matrix[k][j];
          if (val > maxVal) maxVal = val;
        }
        res[i][j] = maxVal;
      }
    }
    return new FuzzyRelation(res);
  }

  public static union(A: FuzzyRelation, B: FuzzyRelation): FuzzyRelation {
    if (A.rows !== B.rows || A.cols !== B.cols) throw new Error('Dimension mismatch for union.');
    const res: number[][] = Array.from({ length: A.rows }, () => new Array(A.cols).fill(0));
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        res[i][j] = Math.max(A.matrix[i][j], B.matrix[i][j]);
      }
    }
    return new FuzzyRelation(res);
  }

  public static isSubset(A: FuzzyRelation, B: FuzzyRelation): { is: boolean, counterexample?: [number, number] } {
    if (A.rows !== B.rows || A.cols !== B.cols) throw new Error('Dimension mismatch.');
    for (let i = 0; i < A.rows; i++) {
      for (let j = 0; j < A.cols; j++) {
        // use numerical tolerance
        if (A.matrix[i][j] > B.matrix[i][j] + 1e-12) {
          return { is: false, counterexample: [i, j] };
        }
      }
    }
    return { is: true };
  }

  public analyzeProperties(): RelationPropertyReport {
    if (this.rows !== this.cols) {
      throw new Error('Properties require a square relation.');
    }
    
    let reflexive = { is: true, counterexample: undefined as [number, number] | undefined };
    let irreflexive = { is: true, counterexample: undefined as [number, number] | undefined };
    let symmetric = { is: true, counterexample: undefined as [number, number] | undefined };
    let antisymmetric = { is: true, counterexample: undefined as [number, number] | undefined };
    
    for (let i = 0; i < this.rows; i++) {
      if (this.matrix[i][i] < 1 - 1e-12) reflexive = { is: false, counterexample: [i, i] };
      if (this.matrix[i][i] > 1e-12) irreflexive = { is: false, counterexample: [i, i] };
      
      for (let j = 0; j < this.cols; j++) {
        if (Math.abs(this.matrix[i][j] - this.matrix[j][i]) > 1e-12) {
          symmetric = { is: false, counterexample: [i, j] };
        }
        if (i !== j && this.matrix[i][j] > 1e-12 && this.matrix[j][i] > 1e-12) {
                    // Fuzzy antisymmetry definition: min(R(x,y), R(y,x)) == 0 for x != y
          if (Math.min(this.matrix[i][j], this.matrix[j][i]) > 1e-12) {
            antisymmetric = { is: false, counterexample: [i, j] };
          }
        }
      }
    }
    
    const squared = FuzzyRelation.compose(this, this, 'max-min');
    const transCheck = FuzzyRelation.isSubset(squared, this);
    const transitive = { 
      is: transCheck.is, 
      counterexample: transCheck.counterexample 
        ? [transCheck.counterexample[0], transCheck.counterexample[1], -1] as [number, number, number] 
        : undefined 
    };

    const isTolerance = reflexive.is && symmetric.is;
    const isEquivalence = isTolerance && transitive.is;

    return { reflexive, irreflexive, symmetric, antisymmetric, transitive, isTolerance, isEquivalence };
  }

  public transitiveClosure(limit: number = 100): RelationClosureResult {
    let current: FuzzyRelation = this;
    let converged = false;
    let iter = 0;
    
    for (; iter < limit; iter++) {
      const next = FuzzyRelation.union(current, FuzzyRelation.compose(current, current, 'max-min'));
      if (FuzzyRelation.isSubset(next, current).is) {
        converged = true;
        break;
      }
      current = next;
    }
    
    return {
      matrix: current.matrix,
      iterations: iter + 1,
      converged,
      trace: [{ step: 'Closure', description: Ran \{iter+1} iterations }]
    };
  }
}

