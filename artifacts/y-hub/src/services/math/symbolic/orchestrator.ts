import { CanonicalAST } from '../types/ast';
import { 
  OrchestrationRequest, OrchestrationResult, IntegrationMode, 
  IntegrationStrategyTrace, OrchestrationContext, DefiniteIntegrationRequest 
} from '../types/integration';
import { DomainAnalyzer } from '../domain';
import { IntegrationEngine } from './integration';
import { DefiniteIntegrationEngine } from './definite_integration';
import { ImproperIntegrationEngine } from './improper_integration';
import { NumericalIntegrationEngine } from './numerical_integration';
import { DerivativeEngine } from './derivative';
import { SymbolicSimplifier } from './simplifier';
import { ASTUtils } from './utils';
import { SetEngine } from './sets';
import { InequalityEngine } from './inequality';

import { CalculusAdapter } from '../python/CalculusAdapter';

export class AdvancedIntegrationOrchestrator {
  private adapter = new CalculusAdapter();

    private isHeavyAST(ast: any): boolean {
      if (!ast) return false;
      const str = JSON.stringify(ast);
      if (str.includes('"exp"') || str.includes('"log"') || str.includes('"erf"') || str.includes('"sin"') || str.includes('"cos"')) {
          return true;
      }
      const divMatch = str.match(/"operator":"\/"/g);
      if (divMatch && divMatch.length > 1) {
          return true;
      }
      return false;
  }

  public async orchestrateAsync(req: OrchestrationRequest): Promise<OrchestrationResult> {
    const isHeavy = this.isHeavyAST(req.integrand);
    
    if (!isHeavy) {
        const fastReq = { ...req, maxDepth: 2, maxTransformations: 5 };
        const tsRes = this.orchestrate(fastReq);
        if (tsRes.finalClassification !== 'unsupported' && tsRes.finalClassification !== 'resource_limit') {
            (tsRes as any).provider = 'typescript';
            return tsRes;
        }
    }

    try {
      const pyRes = await this.adapter.executePythonCalculus('integrate', req.integrand, req.variable, req.lowerBound, req.upperBound);
      if (pyRes !== null) {
         if (pyRes.status === 'solved') {
            return {
               request: req,
               modeExecuted: (req.lowerBound && req.upperBound) ? 'symbolic_definite' : 'symbolic_indefinite',
               finalClassification: pyRes.classification || 'exact_symbolic',
               symbolicResult: pyRes.result,
               definiteResult: (req.lowerBound && req.upperBound) ? pyRes.result : null,
               improperResult: null,
               numericalResult: null,
               trace: pyRes.steps || [],
               warnings: pyRes.warnings || [],
               provider: 'python'
            } as any;
         } else if (pyRes.status === 'no_solution' || pyRes.status === 'invalid_input') {
             return {
               request: req,
               modeExecuted: 'symbolic_indefinite',
               finalClassification: pyRes.status,
               symbolicResult: null,
               definiteResult: null,
               improperResult: null,
               numericalResult: null,
               trace: pyRes.steps || [],
               warnings: pyRes.warnings || [],
               provider: 'python'
             } as any;
         }
      }
    } catch (e) {}

    const fallbackRes = this.orchestrate(req);
    (fallbackRes as any).provider = 'fallback_typescript';
    return fallbackRes;
  }
  private domainAnalyzer = new DomainAnalyzer();
  private derivativeEngine = new DerivativeEngine();
  private simplifier = new SymbolicSimplifier();
  private inequalityEngine = new InequalityEngine();

  // Lazy instantiate engines to avoid circular deps / heavy startup
  private get integrationEngine() { return new IntegrationEngine(); }
  private get definiteEngine() { return new DefiniteIntegrationEngine(); }
  private get improperEngine() { return new ImproperIntegrationEngine(); }
  private get numericalEngine() { return new NumericalIntegrationEngine(); }


  public orchestrate(req: OrchestrationRequest): OrchestrationResult {
    const trace: IntegrationStrategyTrace[] = [];
    const warnings: string[] = [];
    
    // 1. Classification
    let mode = req.mode;
    if (mode === 'auto') {
      mode = this.classifyRequest(req);
      trace.push({
        strategy: 'Classification',
        applicability: 'applicable',
        attempted: true,
        depth: 0,
        resultStatus: mode,
        reason: 'Auto-classified based on bounds and domain'
      });
    }

    // Explicit User Mode routing
    switch (mode) {
      case 'symbolic_indefinite':
        return this.routeIndefinite(req, trace, warnings);
      case 'symbolic_definite':
        return this.routeDefinite(req, trace, warnings);
      case 'symbolic_improper':
        return this.routeImproper(req, trace, warnings);
      case 'numerical':
        return this.routeNumerical(req, trace, warnings);
      default:
        return this.buildResult(req, mode, 'unsupported', null, null, null, null, trace, warnings);
    }
  }

  private classifyRequest(req: OrchestrationRequest): IntegrationMode {
    if (!req.lowerBound || !req.upperBound) {
      return 'symbolic_indefinite';
    }

    // Check bounds for Infinity
    const lInf = ASTUtils.isInfinity(req.lowerBound);
    const uInf = ASTUtils.isInfinity(req.upperBound);
    if (lInf || uInf) {
      return 'symbolic_improper';
    }

    // Ensure bounds are constant (we don't do purely algebraic definite classification yet)
    // For orchestration purposes, if we can evaluate the bounds, we check singularities.
    let valA = NaN;
    let valB = NaN;
    try {
        const ev = new (require('./evaluator').ASTEvaluator)();
        valA = ev.evaluate(req.lowerBound, new Map());
        valB = ev.evaluate(req.upperBound, new Map());
    } catch {
        // If they are purely symbolic (e.g. ∫_a^b), default to definite and let 6G handle it.
        return 'symbolic_definite';
    }

    if (isNaN(valA) || isNaN(valB)) {
        return 'symbolic_definite'; // Could be symbolic bounds
    }

    // Check domain for interior or endpoint singularities
    const restrictions = this.domainAnalyzer.analyze(req.integrand);
    if (restrictions.length > 0) {
       let domainSet = SetEngine.createRealLine();
       for (const r of restrictions) {
          if (r.type === 'inverse_trig' || r.type === 'inverse_sec_csc') continue; // Simplified check for classification
          const ineq: CanonicalAST = { type: 'Inequality', operator: r.type === 'denominator' ? '!=' : (r.type === 'even_root' ? '>=' : '>'), lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
          const solved = this.inequalityEngine.solve(ineq, req.variable);
          if (solved.kind === 'solution_set') {
             domainSet = { type: 'SolutionSet', variable: req.variable, domainRestrictions: [], intervals: SetEngine.intersection(domainSet.intervals, solved.solution.intervals) };
          }
       }
       
       const minBnd = Math.min(valA, valB);
       const maxBnd = Math.max(valA, valB);
       
       for (const interval of domainSet.intervals) {
           const min = interval.left.type === 'infinity' ? -Infinity : Number(interval.left.rational!.num)/Number(interval.left.rational!.den);
           const max = interval.right.type === 'infinity' ? Infinity : Number(interval.right.rational!.num)/Number(interval.right.rational!.den);
           
           if (minBnd >= min && maxBnd <= max) {
               if ((minBnd === min && !interval.leftClosed) || (maxBnd === max && !interval.rightClosed)) {
                   return 'symbolic_improper'; // Endpoint singularity
               }
           } else if (minBnd < max && maxBnd > min) {
               return 'symbolic_improper'; // Interior singularity or gap
           }
       }
    }
    
    return 'symbolic_definite';
  }

  private routeIndefinite(req: OrchestrationRequest, trace: IntegrationStrategyTrace[], warnings: string[]): OrchestrationResult {
    const context: OrchestrationContext = {
      activeStrategies: new Set(),
      attemptedStrategies: new Set(),
      depth: 0,
      transformationCount: 0,
      parentStrategy: null,
      maxDepth: req.maxDepth ?? 6,
      maxAttempts: req.maxStrategyAttempts ?? 10,
      maxTransformations: req.maxTransformations ?? 20
    };

    // An explicitly supplied zero budget means no symbolic work is
    // permitted. Do not silently replace zero with the default.
    if (
      context.maxDepth <= 0 ||
      context.maxAttempts <= 0 ||
      context.maxTransformations <= 0
    ) {
      trace.push({
        strategy: 'IntegrationEngine',
        applicability: 'applicable',
        attempted: false,
        depth: 0,
        resultStatus: 'resource_limit',
        reason: 'Requested orchestration resource budget is exhausted'
      });

      return this.buildResult(
        req,
        'symbolic_indefinite',
        'resource_limit',
        null,
        null,
        null,
        null,
        trace,
        warnings
      );
    }

    try {
        const result = this.integrationEngine.integrate(req.integrand, req.variable, [], 0, context);
        
        // Result Acceptance Verification
        const diff = this.derivativeEngine.differentiate(result, req.variable);
        const verified = this.areEquivalent(req.integrand, diff);

        trace.push({
           strategy: 'IntegrationEngine', applicability: 'applicable', attempted: true, depth: context.depth,
           resultStatus: verified ? 'exact_symbolic' : 'conditionally_valid',
           verificationStatus: verified ? 'exactly_equivalent' : 'not_proven'
        });

        return this.buildResult(req, 'symbolic_indefinite', verified ? 'exact_symbolic' : 'conditionally_valid', result, null, null, null, trace, warnings);
    } catch (e: any) {
        if (e.message === 'resource_limit') {
           trace.push({ strategy: 'IntegrationEngine', applicability: 'applicable', attempted: true, depth: context.depth, resultStatus: 'resource_limit' });
           return this.buildResult(req, 'symbolic_indefinite', 'resource_limit', null, null, null, null, trace, warnings);
        }
        trace.push({ strategy: 'IntegrationEngine', applicability: 'applicable', attempted: true, depth: context.depth, resultStatus: 'unresolved', reason: e.message });
        return this.buildResult(req, 'symbolic_indefinite', 'unresolved', null, null, null, null, trace, warnings);
    }
  }

  private areEquivalent(a: CanonicalAST, b: CanonicalAST): boolean {
     const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [a, b] });
     if (diff.type === 'Number' && diff.value === '0') return true;
     return ASTUtils.structuralEquals(this.simplifier.simplify(a), this.simplifier.simplify(b));
  }

  private routeDefinite(req: OrchestrationRequest, trace: IntegrationStrategyTrace[], warnings: string[]): OrchestrationResult {
    const dReq: DefiniteIntegrationRequest = {
        integrand: req.integrand,
        variable: req.variable,
        lowerBound: req.lowerBound!,
        upperBound: req.upperBound!
    };
    try {
        const res =
          this.definiteEngine.evaluateDefiniteIntegral(dReq);

        trace.push({
          strategy: 'DefiniteIntegrationEngine (6G)',
          applicability: 'applicable',
          attempted: true,
          depth: 0,
          resultStatus: res.classification
        });

        // The initial classifier is intentionally lightweight.
        // If authoritative 6G domain analysis discovers an endpoint
        // or interior singularity, auto mode must promote the request
        // to the improper engine rather than lose the original-domain
        // exclusion through orchestration.
        if (
          req.mode === 'auto' &&
          res.classification === 'improper_detected'
        ) {
          trace.push({
            strategy: 'ImproperPromotion',
            applicability: 'applicable',
            attempted: true,
            depth: 0,
            resultStatus: 'symbolic_improper',
            reason:
              '6G detected an original-domain singularity'
          });

          return this.routeImproper(
            req,
            trace,
            warnings
          );
        }

        return this.buildResult(
          req,
          'symbolic_definite',
          res.classification,
          null,
          res,
          null,
          null,
          trace,
          warnings
        );
    } catch (e: any) {
        return this.buildResult(req, 'symbolic_definite', 'unresolved', null, null, null, null, trace, warnings);
    }
  }

  private routeImproper(req: OrchestrationRequest, trace: IntegrationStrategyTrace[], warnings: string[]): OrchestrationResult {
    const dReq: DefiniteIntegrationRequest = {
        integrand: req.integrand,
        variable: req.variable,
        lowerBound: req.lowerBound!,
        upperBound: req.upperBound!
    };
    try {
        const res = this.improperEngine.evaluateImproperIntegral(dReq);
        trace.push({ strategy: 'ImproperIntegrationEngine (6H)', applicability: 'applicable', attempted: true, depth: 0, resultStatus: res.classification });
        return this.buildResult(req, 'symbolic_improper', res.classification, null, null, res, null, trace, warnings);
    } catch (e: any) {
        return this.buildResult(req, 'symbolic_improper', 'unresolved', null, null, null, null, trace, warnings);
    }
  }

  private routeNumerical(req: OrchestrationRequest, trace: IntegrationStrategyTrace[], warnings: string[]): OrchestrationResult {
    const nReq = {
        integrand: req.integrand,
        variable: req.variable,
        lowerBound: req.lowerBound!,
        upperBound: req.upperBound!,
        method: req.numericalMethod || 'adaptive_simpson',
        tolerance: req.numericalTolerance,
        subdivisions: req.numericalSubdivisions
    };
    try {
        const res = this.numericalEngine.evaluateNumericalIntegral(nReq);
        trace.push({ strategy: 'NumericalIntegrationEngine (6I)', applicability: 'applicable', attempted: true, depth: 0, resultStatus: res.classification });
        return this.buildResult(req, 'numerical', res.classification, null, null, null, res, trace, warnings);
    } catch (e: any) {
        return this.buildResult(req, 'numerical', 'unresolved', null, null, null, null, trace, warnings);
    }
  }

  private buildResult(
    req: OrchestrationRequest,
    mode: IntegrationMode,
    classification: string,
    sym: CanonicalAST | null,
    def: any,
    imp: any,
    num: any,
    trace: IntegrationStrategyTrace[],
    warnings: string[]
  ): OrchestrationResult {
    return {
      request: req,
      modeExecuted: mode,
      finalClassification: classification,
      symbolicResult:
        sym === null ? undefined : sym,
      definiteResult:
        def === null ? undefined : def,
      improperResult:
        imp === null ? undefined : imp,
      numericalResult:
        num === null ? undefined : num,
      trace,
      warnings
    };
  }
}






