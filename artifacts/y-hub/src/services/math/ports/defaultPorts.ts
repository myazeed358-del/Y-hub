import { createDomainEnginePort, isObject } from './enginePort';
import { FunctionAnalyzer } from '../analysis/FunctionAnalyzer';
import { ODEOrchestrator } from '../ode/orchestrator';
import { SystemODEOrchestrator } from '../ode/system_orchestrator';
import { LinearAlgebraOrchestrator } from '../linear_algebra/orchestrator';
import { FuzzyOrchestrator } from '../fuzzy/orchestrator';
import { InequalityEngine } from '../symbolic/inequality';
import { IntegrationEngine } from '../symbolic/integration';
import { AdvancedIntegrationOrchestrator } from '../symbolic/orchestrator';
import { EquationSolver, type SolverOptions } from '../symbolic/equation';
import { LimitEngine } from '../symbolic/limit';
import { NumericSolver } from '../numeric';
import type { CanonicalAST } from '../types/ast';
import type { ODERequest, ODEResult, SystemODERequest, SystemODEResult } from '../types/ode';
import type { LinearAlgebraRequest, LinearAlgebraResult } from '../linear_algebra/types';
import type { FuzzyInferenceRequest, FuzzyResult } from '../fuzzy/types';
import type { FunctionAnalysisRequest, FunctionAnalysisResult } from '../types/analysis';
import type { OrchestrationRequest, OrchestrationResult, IntegrationRequest, IntegrationResult } from '../types/integration';
import type { LimitRequest } from '../types/limit';
import type { LimitResult } from '../types/result';
import type { InequalitySolveResult } from '../symbolic/inequality';

/** Composition root only: engines never import from this catalog. */
const isAST = (v: unknown): v is CanonicalAST => isObject(v) && typeof v.type === 'string';
const isVariable = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const hasResults = (v: unknown): boolean => isObject(v) && Array.isArray(v.steps);

export const functionAnalysisPort = createDomainEnginePort<FunctionAnalysisRequest, FunctionAnalysisResult>(
  'function-analysis',
  (v): v is FunctionAnalysisRequest => isObject(v) && isAST(v.expression) && isVariable(v.variable),
  v => new FunctionAnalyzer().analyze(v),
  (v): v is FunctionAnalysisResult => isObject(v) && isObject(v.domain) &&
    Array.isArray(v.criticalPoints) && Array.isArray(v.discontinuities) && Array.isArray(v.steps),
);

export const odePort = createDomainEnginePort<ODERequest, ODEResult>(
  'ode',
  (v): v is ODERequest => isObject(v) && isAST(v.equation) && isVariable(v.independentVariable),
  v => new ODEOrchestrator().executeAsync(v),
  (v): v is ODEResult => isObject(v) && typeof v.status === 'string' &&
    Array.isArray(v.solutions) && Array.isArray(v.trace) && Array.isArray(v.warnings) &&
    (v.status !== 'exact_symbolic' || v.solutions.length > 0),
);

export const systemOdePort = createDomainEnginePort<SystemODERequest, SystemODEResult>(
  'system-ode',
  (v): v is SystemODERequest => isObject(v) && Array.isArray(v.equations) &&
    v.equations.length > 0 && v.equations.every(isAST) && isVariable(v.independentVariable),
  v => new SystemODEOrchestrator().executeAsync(v),
  (v): v is SystemODEResult => isObject(v) && typeof v.status === 'string' &&
    Array.isArray(v.solutions) && Array.isArray(v.trace) && Array.isArray(v.warnings) &&
    (v.status !== 'exact_symbolic' || v.solutions.length > 0),
);

export const linearAlgebraPort = createDomainEnginePort<LinearAlgebraRequest, LinearAlgebraResult>(
  'linear-algebra',
  (v): v is LinearAlgebraRequest => isObject(v) && typeof v.operation === 'string' &&
    ['auto','exact','numerical'].includes(String(v.mode)) && Array.isArray(v.matrices),
  v => new LinearAlgebraOrchestrator().executeAsync(v),
  (v): v is LinearAlgebraResult => isObject(v) && typeof v.operation === 'string' &&
    typeof v.status === 'string' && typeof v.exactness === 'string' &&
    // No successful shell with missing result: validate operation-specific payloads.
    (v.status !== 'solved' && v.status !== 'completed' ||
       (v.operation === 'determinant' ? isAST(v.resultScalar) :
        ['inverse','rref'].includes(String(v.operation)) ? Array.isArray(v.resultMatrix) :
        v.operation === 'solve_system' ? isObject(v.linearSystem) :
        v.operation === 'eigen' ? isObject(v.eigenStructure) :
        ['least_squares'].includes(String(v.operation)) ? Array.isArray(v.resultVector) && isAST(v.resultScalar) :
        ['leontief','markov_steady_state'].includes(String(v.operation)) ? Array.isArray(v.resultVector) :
        ['gram_schmidt','definiteness','null_space','power_method','lu'].includes(String(v.operation)) ? Array.isArray(v.explanationSteps) :
        v.operation === 'svd' ? isObject(v.svd) : false)),
);

export const fuzzyPort = createDomainEnginePort<FuzzyInferenceRequest, FuzzyResult>(
  'fuzzy',
  (v): v is FuzzyInferenceRequest => isObject(v) && Array.isArray(v.rules),
  v => new FuzzyOrchestrator().orchestrateAsync(v),
  (v): v is FuzzyResult => isObject(v) && isObject(v.crispOutputs) &&
    typeof v.provider === 'string' && Array.isArray(v.warnings) && Array.isArray(v.trace),
);

export interface InequalityInput { expression: CanonicalAST; variable: string }
export const inequalityPort = createDomainEnginePort<InequalityInput, InequalitySolveResult>(
  'inequality',
  (v): v is InequalityInput => isObject(v) && isAST(v.expression) && isVariable(v.variable),
  v => new InequalityEngine().solve(v.expression, v.variable),
  (v): v is InequalitySolveResult => isObject(v) && Array.isArray(v.steps) &&
    (v.kind === 'unsupported' ? typeof v.status === 'string' :
      v.kind === 'solution_set' && isObject(v.solution) && Array.isArray(v.solution.intervals)),
);

export const integrationPort = createDomainEnginePort<IntegrationRequest, IntegrationResult>(
  'integration',
  (v): v is IntegrationRequest => isObject(v) && isAST(v.integrand) && isVariable(v.variable),
  v => new IntegrationEngine().integrateRequest(v),
  (v): v is IntegrationResult => isObject(v) && typeof v.status === 'string' &&
    Array.isArray(v.steps) && isObject(v.domain) &&
    (v.status !== 'exact_symbolic' || isAST(v.antiderivative)),
);

export const advancedIntegrationPort = createDomainEnginePort<OrchestrationRequest, OrchestrationResult>(
  'advanced-integration',
  (v): v is OrchestrationRequest => isObject(v) && isAST(v.integrand) && isVariable(v.variable) && typeof v.mode === 'string',
  v => new AdvancedIntegrationOrchestrator().orchestrateAsync(v),
  (v): v is OrchestrationResult => isObject(v) && typeof v.finalClassification === 'string' &&
    Array.isArray(v.trace) && Array.isArray(v.warnings),
);

export interface EquationInput { equation: CanonicalAST; variable: string; options?: SolverOptions }
export type EquationOutput = ReturnType<EquationSolver['solve']>;
export const equationPort = createDomainEnginePort<EquationInput, EquationOutput>(
  'equation',
  (v): v is EquationInput => isObject(v) && isAST(v.equation) && isVariable(v.variable),
  v => new EquationSolver().solve(v.equation, v.variable, v.options),
  (v): v is EquationOutput => isObject(v) && Array.isArray(v.finalSolutions) &&
    Array.isArray(v.rejectedSolutions) && typeof v.completeness === 'string',
);

export const limitPort = createDomainEnginePort<LimitRequest, LimitResult>(
  'limit',
  (v): v is LimitRequest => isObject(v) && isAST(v.expression) && isVariable(v.variable),
  v => new LimitEngine().evaluateLimit(v),
  (v): v is LimitResult => isObject(v) && v.type === 'limit' &&
    typeof v.classification === 'string' && Array.isArray(v.steps),
);

export interface NumericRootInput {
  expression: CanonicalAST; variable: string; initialGuess?: number;
  tolerance?: number; maxIterations?: number;
}
export type NumericRootOutput = ReturnType<NumericSolver['solveNewton']>;
export const numericRootPort = createDomainEnginePort<NumericRootInput, NumericRootOutput>(
  'numeric-root',
  (v): v is NumericRootInput => isObject(v) && isAST(v.expression) && isVariable(v.variable),
  v => new NumericSolver().solveNewton(v.expression, v.variable, v.initialGuess, v.tolerance, v.maxIterations),
  (v): v is NumericRootOutput => v === null ||
    (isObject(v) && Number.isFinite(v.root) && Number.isFinite(v.residual) && Number.isInteger(v.iterations)),
);

export const standardMathEnginePorts = [
  functionAnalysisPort, odePort, systemOdePort, linearAlgebraPort,
  fuzzyPort, inequalityPort, integrationPort, advancedIntegrationPort,
  equationPort, limitPort, numericRootPort,
] as const;
