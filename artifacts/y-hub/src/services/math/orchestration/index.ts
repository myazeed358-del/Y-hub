import { MathProblemRequest, MathOptions, Assumption } from '../types/problem';
import { MathResult, ErrorResult } from '../types/result';
import { MathStep } from '../types/step';
import { ProblemClassifier } from '../classifier';
import { DomainAnalyzer } from '../domain';
import { PythonMathAdapter } from '../python/adapter';
import { MathVerifier } from '../verification';
import { CanonicalAST } from '../types/ast';

export class MathOrchestrator {
  private classifier = new ProblemClassifier();
  private domainAnalyzer = new DomainAnalyzer();
  private pythonAdapter = new PythonMathAdapter();
  private verifier = new MathVerifier();

  /**
   * The main pipeline: Understand -> Parse -> Classify -> Solve -> Verify -> Explain
   */
  public async solve(
    rawInput: string, 
    options?: Partial<MathOptions>, 
    assumptions: Assumption[] = []
  ): Promise<MathResult> {
    const startTime = Date.now();

    try {
      // 1. Parse & Classify
      const request = this.classifier.classify(rawInput, options, assumptions);
      
      if (!request.expression) {
        return this.buildError('parse_error', 'Could not parse the mathematical expression.', startTime);
      }

      // 2. Domain & Hazard Analysis
      const restrictions = this.domainAnalyzer.analyze(request.expression);
      const conditions = restrictions.map(r => r.message);
      
      // 3. Routing (Local vs Python)
      // For Step E.1, we demonstrate the Python boundary routing.
      // E.g., integration and limits go to Python. Differentiation can be local or Python.
      const requiresPython = ['integrate', 'limit', 'solve_ode', 'matrix_rref', 'eigenvalues'].includes(request.operation);
      
      let finalAst: CanonicalAST;
      let engineUsed: 'local_ts' | 'python_sympy' = 'local_ts';
      let steps: MathStep[] = [];
      let latex: string = '';

      if (requiresPython || request.operation === 'derive') {
        // We explicitly test 'derive' in Python as per Step E.1 E2E requirements
        engineUsed = 'python_sympy';
        const pyResponse = await this.pythonAdapter.compute(request);
        
        if (!pyResponse.success || pyResponse.error) {
          return this.buildError('internal_error', pyResponse.error || 'Python computation failed.', startTime);
        }
        if (!pyResponse.result_ast) {
          return this.buildError('internal_error', 'Python returned no AST.', startTime);
        }
        
        finalAst = pyResponse.result_ast;
        steps = pyResponse.steps;
        latex = pyResponse.result_latex || '';
      } else {
        // Use TS Symbolic Engine (Simplifier, local Derivative, etc.)
        // Implementation omitted for brevity in this pipeline view
        throw new Error("Operation routed to local TS engine which is partially stubbed in E.1.");
      }

      // 4. Verification Engine
      let verificationResult = undefined;
      const variable = request.variable || 'x';
      
      if (request.operation === 'integrate') {
        verificationResult = this.verifier.verifyIntegral(request.expression, finalAst, variable);
      } else if (request.operation === 'derive') {
        // Local deterministic verification logic
        verificationResult = this.verifier.verifyDerivative(request.expression, finalAst, variable);
      } else if (request.operation === 'solve_equation') {
        // verificationResult = this.verifier.verifyEquationRoot(...)
      }

      // 5. Build Result
      return {
        type: 'symbolic',
        expression: 'Stringified fallback or canonical', 
        latex: latex,
        exact: true,
        steps,
        warnings: [],
        conditions,
        verification: verificationResult,
        computationTimeMs: Date.now() - startTime,
        engineUsed
      };

    } catch (e: any) {
      return this.buildError('internal_error', e.message, startTime);
    }
  }

  private buildError(type: 'parse_error' | 'internal_error' | 'unsupported', message: string, startTime: number): ErrorResult {
    return {
      type: 'error',
      errorType: type,
      errorMessage: message,
      steps: [],
      warnings: [],
      conditions: [],
      computationTimeMs: Date.now() - startTime,
      engineUsed: 'local_ts'
    };
  }
}
