import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { FunctionAnalysisRequest, FunctionAnalysisResult, VerificationFailure } from '../types/analysis';

import { DomainAnalyzer } from '../domain';


import { DerivativeEngine } from '../symbolic/derivative';


import { classifyFunction } from './functionClassification';
import { GraphDataBuilder } from './graphDataBuilder';
import { AsymptoteAnalyzer } from './asymptoteAnalyzer';
import { FunctionContinuityService } from './FunctionContinuityService';
import { FunctionDifferentialService } from './FunctionDifferentialService';

export class FunctionAnalyzer {
  private continuity = new FunctionContinuityService();
  private differential = new FunctionDifferentialService();
  private graphDataBuilder = new GraphDataBuilder();
  private asymptoteAnalyzer = new AsymptoteAnalyzer();
  private domainAnalyzer = new DomainAnalyzer();


  private derivativeEngine = new DerivativeEngine();

  public analyze(req: FunctionAnalysisRequest): FunctionAnalysisResult {
    const steps: MathStep[] = [];
    const ast = req.expression;
    const variable = req.variable;

    // 1. Classification
    const classification = classifyFunction(ast);

    // 2. Domain Analysis
    const domainRestrictions = this.domainAnalyzer.analyze(ast);
    const domainSet = this.continuity.computeDomain(domainRestrictions, variable, steps);

    // 3. X-Intercepts
    const xInterceptsResult = this.continuity.computeXIntercepts(ast, variable, domainSet, steps);

    // 4. Y-Intercept
    const yIntercept = this.continuity.computeYIntercept(ast, variable, domainSet, steps);

    // 5. Discontinuity Candidates
    const candidates = this.continuity.findDiscontinuityCandidates(domainRestrictions, ast, variable);

    // 6. Continuity Analysis
    const discontinuities = this.continuity.analyzeContinuity(ast, variable, candidates, domainSet, steps);

    // 7. Verification (done implicitly during analysis)
    const verification: VerificationFailure[] = [];

    // --- PHASE 5B: First Derivative Analysis ---
    let firstDerivative: CanonicalAST;
    try {
      firstDerivative = this.derivativeEngine.differentiate(ast, variable, steps);
    } catch {
      firstDerivative = { type: 'Number', value: '0' }; // fallback if diff fails
    }
    const derivRestrictions = this.domainAnalyzer.analyze(firstDerivative);
    const derivDomain = this.continuity.computeDomain(derivRestrictions, variable, steps);

    const criticalPoints = this.differential.findCriticalPoints(firstDerivative, derivDomain, domainSet, variable, steps);

    // --- PHASE 5C: Monotonicity & Extrema ---
    const { increasingIntervals, decreasingIntervals } = this.differential.analyzeMonotonicity(firstDerivative, domainSet, variable, discontinuities);
    const extrema = this.differential.findExtrema(criticalPoints, increasingIntervals, decreasingIntervals, domainSet);

    // --- PHASE 5D: Concavity & Inflection ---
    let secondDerivative: CanonicalAST;
    try {
      secondDerivative = this.derivativeEngine.differentiate(firstDerivative, variable, steps);
    } catch {
      secondDerivative = { type: 'Number', value: '0' };
    }
    const secondDerivRestrictions = this.domainAnalyzer.analyze(secondDerivative);
    const secondDerivDomain = this.continuity.computeDomain(secondDerivRestrictions, variable, steps);

    const { concaveUpIntervals, concaveDownIntervals } = this.differential.analyzeConcavity(secondDerivative, domainSet, variable);
    const inflectionPoints = this.differential.findInflectionPoints(secondDerivative, secondDerivDomain, concaveUpIntervals, concaveDownIntervals, domainSet, variable);

    // --- PHASE 5E: Asymptotes ---
    const { asymptotes, infiniteBehavior } = this.asymptoteAnalyzer.analyze(ast, variable, discontinuities);

    // --- PHASE 5F: Graph Data ---
    const graphData = this.graphDataBuilder.build(
       domainSet, criticalPoints, increasingIntervals, decreasingIntervals,
       concaveUpIntervals, concaveDownIntervals, asymptotes,
       Array.isArray(xInterceptsResult) ? (yIntercept ? [...xInterceptsResult, yIntercept] : xInterceptsResult) : (yIntercept ? [yIntercept] : []),
       extrema, inflectionPoints, discontinuities
    );

    return {
      variable,
      domain: domainSet,
      classification,
      xIntercepts: xInterceptsResult,
      yIntercept,
      discontinuities,

      derivativeAnalysis: {
        firstDerivative,
        firstDerivativeDomain: derivDomain,
        secondDerivative,
        secondDerivativeDomain: secondDerivDomain
      },
      criticalPoints,
      increasingIntervals,
      decreasingIntervals,
      extrema,
      concaveUpIntervals,
      concaveDownIntervals,
      inflectionPoints,
      asymptotes,
      verticalAsymptotes:
        asymptotes.filter(
          asymptote =>
            asymptote.type === 'vertical'
        ),
      horizontalAsymptotes:
        asymptotes.filter(
          asymptote =>
            asymptote.type === 'horizontal'
        ),
      slantAsymptotes:
        asymptotes.filter(
          asymptote =>
            asymptote.type === 'slant'
        ),
      infiniteBehavior,
      graphData,

      verification,
      steps
    };
  }


}
