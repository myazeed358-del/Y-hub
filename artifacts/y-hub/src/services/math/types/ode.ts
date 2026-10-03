import { CanonicalAST } from './ast';
import { SolutionSet } from './set';
import type { IntegrationExecutionContext, VerificationStatus } from './integration';

export type ODEClassification = 'separable' | 'linear' | 'exact' | 'bernoulli' | 'homogeneous' | 'autonomous' | 'numerical' | 'unsupported' | 'FIRST_ORDER' | 'SECOND_ORDER' | 'HIGHER_ORDER' | 'SECOND_ORDER_IVP' | 'HIGHER_ORDER_IVP' | 'BVP' | 'NUMERICAL_ODE' | 'SYSTEM_FIRST_ORDER' | 'LINEAR_SYSTEM' | 'CONSTANT_COEFFICIENT_SYSTEM' | 'NONHOMOGENEOUS_SYSTEM' | 'SYSTEM_IVP' | 'PHASE_PLANE_SYSTEM' | 'NUMERICAL_SYSTEM';
export type ODESolutionType = 'explicit' | 'implicit' | 'equilibrium' | 'numerical' | 'particular';

export interface ODEInitialCondition {
    x0: CanonicalAST;
    y0: CanonicalAST;
    derivatives?: CanonicalAST[]; // [y'(x0), y''(x0), ...]
}

export interface ODEBoundaryCondition {
    x: CanonicalAST;
    y: CanonicalAST;
}

export interface ODERequest {
    equation: CanonicalAST; // Expected to be an Equation node
    independentVariable: string;
    dependentVariable: string;
    derivativeVariable: string; // The base derivative variable name, e.g. 'y_prime' or 'y' if derivatives are represented differently
    higherDerivatives?: string[]; // e.g., ['y_prime', 'y_double_prime', 'y_triple_prime']
    initialCondition?: ODEInitialCondition;
    boundaryConditions?: ODEBoundaryCondition[];
    knownSolutions?: CanonicalAST[];
    mode?: 'symbolic' | 'numerical' | 'qualitative';
    numericalConfig?: {
        method: 'euler' | 'heun' | 'rk4';
        stepSize: number;
        steps: number;
    };
    maxDepth?: number;
    maxAttempts?: number;
    maxTransformations?: number;
}

export interface ODEStep {
    strategy: string;
    inputExpression: CanonicalAST;
    transformation: string;
    resultingExpression: CanonicalAST;
    verificationStatus?: VerificationStatus;
    verificationCondition?: CanonicalAST;
}

export interface ODESolution {
    type: ODESolutionType;
    equation: CanonicalAST; // y = f(x) or F(x,y) = C or y = C
    domain: SolutionSet | null;
    original_ode_domain?: SolutionSet | null;
    transformation_domain?: SolutionSet | null;
    solution_validity_interval?: SolutionSet | null;
    assumptions: string[];
}

export interface ODEQualitativeData {
    equilibria: CanonicalAST[];
    signIntervals: { interval: any; sign: 1 | -1 }[];
    stability: { equilibrium: CanonicalAST; status: 'stable' | 'unstable' | 'semi_stable' | 'unresolved' }[];
}

export interface NumericalODEResult {
    method: string;
    initialCondition: { x0: number; y0: number };
    stepSize: number;
    points: { x: number; y: number }[];
    finalValue: number | null;
    evaluationCount: number;
    convergenceStatus: 'completed' | 'tolerance_met' | 'tolerance_not_met' | 'domain_failure' | 'non_finite_evaluation' | 'resource_limit' | 'invalid_step';
}

export interface ODEResult {
    request: ODERequest;
    classification: ODEClassification;
    solutions: ODESolution[];
    particularSolution?: ODESolution;
    initialConditionValidity?: 'established' | 'not_established' | 'requires_assumption' | 'unsupported' | 'incompatible';
    existence?: 'existence_established' | 'existence_not_established' | 'requires_assumption';
    uniqueness?: 'uniqueness_established' | 'uniqueness_not_established' | 'requires_assumption';
    exactness?: 'locally_exact' | 'globally_exact' | 'requires_domain_condition' | 'not_established';
    qualitative?: ODEQualitativeData;
    numerical?: NumericalODEResult;
    trace: ODEStep[];
    warnings: string[];
    status: 'exact_symbolic' | 'numerical_approximation' | 'unresolved' | 'resource_limit' | 'unsupported' | 'no_solution';
}

export interface ODEOrchestrationContext extends IntegrationExecutionContext {}


export interface SystemODEInitialCondition {
    t0: CanonicalAST;
    X0: CanonicalAST[]; // Array of initial values for each state variable
}

export interface SystemODERequest {
    isSystem: true;
    equations: CanonicalAST[]; // e.g. [x' = 2x+y, y' = x-y]
    independentVariable: string;
    dependentVariables: string[];
    derivativeVariables: string[];
    initialCondition?: SystemODEInitialCondition;
    mode?: 'symbolic' | 'numerical' | 'qualitative';
    numericalConfig?: {
        method: 'euler' | 'heun' | 'rk4';
        stepSize: number;
        steps: number;
    };
}

export interface SystemODESolution {
    type: 'explicit' | 'equilibrium' | 'numerical' | 'particular';
    equations: CanonicalAST[]; // e.g. [x = ..., y = ...]
    domain?: any;
    original_ode_domain?: any;
    transformation_domain?: any;
    solution_validity_interval?: any;
    assumptions?: string[];
}

export interface SystemNumericalResult {
    method: 'euler' | 'heun' | 'rk4';
    initialCondition: { t0: number; X0: number[] };
    stepSize: number;
    points: { t: number; X: number[] }[];
    finalValue: number[] | null;
    evaluationCount: number;
    convergenceStatus: 'completed' | 'tolerance_met' | 'tolerance_not_met' | 'resource_limit' | 'non_finite_evaluation' | 'invalid_step' | 'domain_failure';
}

export interface SystemPhasePlaneData {
    equilibria: { point: CanonicalAST[]; classification: string; status: 'stable' | 'unstable' | 'saddle' | 'center' | 'improper node' | 'repeated/degenerate' | 'unresolved' }[];
    nullclines?: {
        x_nullcline: CanonicalAST;
        y_nullcline: CanonicalAST;
    };
    vectorField?: { x: number; y: number; dx: number; dy: number; magnitude: number }[];
    trajectories?: {
        method: string;
        points: { t: number; X: number[] }[];
        convergenceStatus: string;
    }[];
}

export interface SystemODEResult {
    request: SystemODERequest;
    classification: ODEClassification;
    solutions: SystemODESolution[];
    particularSolution?: SystemODESolution;
    initialConditionValidity?: 'established' | 'incompatible' | 'existence_not_established' | 'uniqueness_not_established';
    numerical?: SystemNumericalResult;
    phasePlane?: SystemPhasePlaneData;
    trace: ODEStep[];
    warnings: string[];
    status: 'exact_symbolic' | 'numerical_approximation' | 'unsupported' | 'unresolved' | 'resource_limit';
    explanationData?: any; // To hold characteristic polynomial, eigenvalues, eigenvectors etc.
}


