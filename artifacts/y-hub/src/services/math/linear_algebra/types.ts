import { CanonicalAST } from '../types/ast';
import { Rational } from '../utils/rational';

export type ExactMatrix = Rational[][];
export type ExactVector = Rational[];

export interface RowOperation {
    type: 'swap' | 'scale' | 'add_multiple';
    row1: number;
    row2?: number; // for swap or add
    scalar?: Rational;
}

export interface LinearSystemResult {
    systemType: 'unique' | 'infinitely_many' | 'inconsistent';
    solution?: ExactVector;
    parametricSolution?: { base: ExactVector; nullSpaceBasis: ExactVector[] };
    rankA: number;
    rankAugmented: number;
    freeVariables: number[];
    pivotColumns: number[];
    steps: { operation: RowOperation; matrix: ExactMatrix }[];
}

export interface EigenStructure {
    eigenvalues: { value: Rational | { real: Rational, imag: Rational } | CanonicalAST; algebraicMultiplicity: number }[];
    eigenvectors: { value: Rational | { real: Rational, imag: Rational } | CanonicalAST; vector: ExactVector | CanonicalAST[] }[];
    diagonalizable: boolean;
    defective: boolean;
    matrixP?: ExactMatrix | CanonicalAST[][];
    matrixD?: ExactMatrix | CanonicalAST[][];
}

export interface VectorSpaceInfo {
    basis: ExactVector[];
    dimension: number;
    isSubspace: boolean;
}

export interface QRDecomposition {
    Q: CanonicalAST[][]; // Or ExactMatrix if exact
    R: CanonicalAST[][];
}

export interface SVDResult {
    U: number[][];
    Sigma: number[];
    V: number[][];
    rank: number;
}

export interface LinearAlgebraRequest {
    operation: string; // 'solve_system', 'rref', 'inverse', 'determinant', 'eigen', 'svd', 'qr', 'gram_schmidt', 'least_squares', 'markov', etc.
    matrices: CanonicalAST[][][];
    vectors?: CanonicalAST[][];
    scalars?: CanonicalAST[];
    mode: 'exact' | 'numerical' | 'auto';
}

export interface LinearAlgebraResult {
    operation: string;
    status: 'solved' | 'no_solution' | 'infinitely_many_solutions' | 'unsupported' | 'resource_limit' | 'invalid_input' | 'completed' | 'not_established';
    exactness: 'exact_symbolic' | 'numerical_approximation';
    resultMatrix?: CanonicalAST[][];
    resultVector?: CanonicalAST[];
    resultScalar?: CanonicalAST;
    linearSystem?: LinearSystemResult;
    eigenStructure?: EigenStructure;
    qr?: QRDecomposition;
    svd?: SVDResult;
    explanationSteps?: any[];
    verificationStatus?: 'exactly_equivalent' | 'numerically_consistent' | 'not_proven' | 'not_equivalent' | 'verification_failed';
    warnings?: string[];
}

