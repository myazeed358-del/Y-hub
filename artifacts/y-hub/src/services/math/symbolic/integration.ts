import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { DerivativeEngine } from './derivative';
import { DomainAnalyzer } from '../domain';
import { InequalityEngine } from './inequality';
import { SetEngine } from './sets';
import { Rat } from '../utils/rational';
import { IntegrationRequest, IntegrationResult, IntegrationStatus, VerificationStatus, SubstitutionStep, IntegrationByPartsStep, TrigIdentityStep, TrigSubstitutionStep } from '../types/integration';
import type { IntegrationExecutionContext } from '../types/integration';
import { SubstitutionEngine } from './substitution';
import { TrigIntegrationEngine } from './trig';
import { TrigSubEngine } from './trig_sub';
import { PartsEngine } from './parts';
import { PartialFractionsEngine } from './partial_fractions';
import { AntiderivativeVerifier } from '../verification/antiderivative';
import { BasicIntegrationRules } from './integrationStrategies/basicRules';
import { ChainRuleIntegration } from './integrationStrategies/chainRule';

export class IntegrationEngine {
  private readonly basicRules = new BasicIntegrationRules();
  private readonly chainRule = new ChainRuleIntegration();
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private substitutionEngine = new SubstitutionEngine();
  private partsEngine = new PartsEngine();
  private pfEngine = new PartialFractionsEngine();
  private trigEngine = new TrigIntegrationEngine();
  private trigSubEngine = new TrigSubEngine();
  private readonly antiderivativeVerifier = new AntiderivativeVerifier();

  // Used to store the top-level substitution step
  private lastSubStep: SubstitutionStep | undefined = undefined;
  private partsSteps: IntegrationByPartsStep[] = [];
  private trigStepsGlobal: TrigIdentityStep[] = [];
  private trigSubStepsGlobal: TrigSubstitutionStep[] = [];

  public integrateRequest(req: IntegrationRequest): IntegrationResult {
    const steps: MathStep[] = [];

    // Domain Analysis
    const restrictions = this.domainAnalyzer.analyze(req.expression);
    let domainSet = SetEngine.createRealLine(req.variable);

    for (const r of restrictions) {
      try {
        if (r.type === 'inverse_trig') {
          // -1 <= u <= 1
          const gteq: CanonicalAST = {
            type: 'Inequality',
            operator: '>=',
            lhs: r.conditionAST,
            rhs: { type: 'Number', value: '-1' }
          };

          const lteq: CanonicalAST = {
            type: 'Inequality',
            operator: '<=',
            lhs: r.conditionAST,
            rhs: { type: 'Number', value: '1' }
          };

          const s1 = this.inequalityEngine.solve(
            gteq,
            req.variable
          );

          const s2 = this.inequalityEngine.solve(
            lteq,
            req.variable
          );

          if (
            s1.kind === 'solution_set' &&
            s2.kind === 'solution_set'
          ) {
            const intersect = SetEngine.intersection(
              s1.solution.intervals,
              s2.solution.intervals
            );

            domainSet = {
              ...domainSet,
              intervals: SetEngine.intersection(
                domainSet.intervals,
                intersect
              )
            };
          }
        } else if (r.type === 'inverse_sec_csc') {
          // u <= -1 OR u >= 1
          const lteq: CanonicalAST = {
            type: 'Inequality',
            operator: '<=',
            lhs: r.conditionAST,
            rhs: { type: 'Number', value: '-1' }
          };

          const gteq: CanonicalAST = {
            type: 'Inequality',
            operator: '>=',
            lhs: r.conditionAST,
            rhs: { type: 'Number', value: '1' }
          };

          const s1 = this.inequalityEngine.solve(
            lteq,
            req.variable
          );

          const s2 = this.inequalityEngine.solve(
            gteq,
            req.variable
          );

          if (
            s1.kind === 'solution_set' &&
            s2.kind === 'solution_set'
          ) {
            const union = SetEngine.union(
              s1.solution.intervals,
              s2.solution.intervals
            );

            domainSet = {
              ...domainSet,
              intervals: SetEngine.intersection(
                domainSet.intervals,
                union
              )
            };
          }
        } else {
          const ineq: CanonicalAST = {
            type: 'Inequality',
            operator:
              r.type === 'denominator'
                ? '!='
                : r.type === 'even_root'
                  ? '>='
                  : '>',
            lhs: r.conditionAST,
            rhs: { type: 'Number', value: '0' }
          };

          const solved = this.inequalityEngine.solve(
            ineq,
            req.variable
          );

          if (solved.kind === 'solution_set') {
            domainSet = {
              ...domainSet,
              intervals: SetEngine.intersection(
                domainSet.intervals,
                solved.solution.intervals
              )
            };
          }
        }
      } catch {
        // Some valid restrictions are symbolic/periodic and cannot
        // be represented as a finite interval union by the current
        // polynomial inequality solver. Preserve the exact
        // restriction instead of discarding the whole domain.
        const condition =
          ASTUtils.serialize(r.conditionAST);

        let relation: string;

        if (r.type === 'denominator') {
          relation = '!= 0';
        } else if (r.type === 'even_root') {
          relation = '>= 0';
        } else if (r.type === 'logarithm') {
          relation = '> 0';
        } else if (r.type === 'inverse_trig') {
          relation = 'in [-1, 1]';
        } else {
          relation = '<= -1 or >= 1';
        }

        const description =
          `${condition} ${relation}`;

        if (
          !domainSet.domainRestrictions.includes(
            description
          )
        ) {
          domainSet.domainRestrictions.push(
            description
          );
        }
      }
    }

    try {
      this.lastSubStep = undefined;
      this.partsSteps = [];
      this.trigStepsGlobal = [];
      this.trigSubStepsGlobal = [];
      const antideriv = this.integrate(req.expression, req.variable, steps);
      const verifiedStatus = this.antiderivativeVerifier.verify(req.expression, antideriv, req.variable);

      return {
        request: req,
        status: 'exact_symbolic',
        antiderivative: antideriv,
        domain: domainSet,
        verificationStatus: verifiedStatus,
        substitution: this.lastSubStep,
        parts: this.partsSteps,
        trigSteps: this.trigStepsGlobal,
        trigSubSteps: this.trigSubStepsGlobal,
        steps
      };
    } catch (e) {
      steps.push({
        id: `int_failed_${Date.now()}`,
        title: 'Integration Failed',
        explanation: e instanceof Error ? e.message : 'Unknown integration error'
      });
      return {
        request: req,
        status: 'unresolved',
        antiderivative: null,
        domain: domainSet,
        verificationStatus: 'verification_failed',
        substitution: this.lastSubStep,
        parts: this.partsSteps,
        steps
      };
    }
  }

  public integrate(node: CanonicalAST, variable: string, steps: MathStep[], depth: number = 0, context?: IntegrationExecutionContext): CanonicalAST {
    const simplified = this.simplifier.simplify(node);

    // Check max depth & transformations
    if (context) {
        if (context.depth > context.maxDepth) throw new Error('resource_limit');
        if (context.transformationCount > context.maxTransformations) throw new Error('resource_limit');
        if (context.attemptedStrategies.size > context.maxAttempts) throw new Error('resource_limit');
        context.depth++;
    } else if (depth > 10) {
        throw new Error('Maximum integration depth exceeded');
    }

    // Linearity: Sums and Differences
    if (simplified.type === 'Operator' && (simplified.operator === '+' || simplified.operator === '-')) {
       steps.push({ id: `int_linearity_${Date.now()}`, title: 'Sum/Difference Rule', explanation: '∫(f ± g)dx = ∫fdx ± ∫gdx' });
       const res = {
         type: 'Operator',
         operator: simplified.operator,
         args: simplified.args.map(a => this.integrate(a, variable, steps, depth + 1, context))
       } as CanonicalAST;
       if (context) context.depth--;
       return res;
    }

    // Rational numerator linearity:
    // (A ± B) / D = A/D ± B/D.
    //
    // This allows the existing integration strategies to handle
    // rational expressions component-by-component.
    if (
       simplified.type === 'Operator' &&
       simplified.operator === '/' &&
       simplified.args[0].type === 'Operator' &&
       (
         simplified.args[0].operator === '+' ||
         simplified.args[0].operator === '-'
       )
    ) {
       const numerator = simplified.args[0];
       const denominator = simplified.args[1];

       const res = {
         type: 'Operator',
         operator: numerator.operator,
         args: numerator.args.map(term =>
           this.integrate(
             {
               type: 'Operator',
               operator: '/',
               args: [term, denominator]
             },
             variable,
             steps,
             depth + 1,
             context
           )
         )
       } as CanonicalAST;

       if (context) context.depth--;
       return this.simplifier.simplify(res);
    }

    // Linearity: Constant Extraction
    if (simplified.type === 'Operator' && simplified.operator === '*') {
       const constants: CanonicalAST[] = [];
       const nonConstants: CanonicalAST[] = [];
       for (const arg of simplified.args) {
          if (!ASTUtils.containsVariable(arg, variable)) constants.push(arg);
          else nonConstants.push(arg);
       }
       if (constants.length > 0 && nonConstants.length > 0) {
          steps.push({ id: `int_const_ext_${Date.now()}`, title: 'Constant Extraction', explanation: '∫cf(x)dx = c∫f(x)dx' });
          const cNode = constants.length === 1 ? constants[0] : { type: 'Operator', operator: '*', args: constants } as CanonicalAST;
          const fnNode = nonConstants.length === 1 ? nonConstants[0] : { type: 'Operator', operator: '*', args: nonConstants } as CanonicalAST;
          const res = this.simplifier.simplify({
            type: 'Operator',
            operator: '*',
            args: [cNode, this.integrate(fnNode, variable, steps, depth + 1, context)]
          });
          if (context) context.depth--;
          return res;
       }
    }

    // Constant
    if (!ASTUtils.containsVariable(simplified, variable)) {
       steps.push({ id: `int_const_${Date.now()}`, title: 'Constant Rule', explanation: '∫ c dx = c x' });
       if (context) context.depth--;
       return this.simplifier.simplify({ type: 'Operator', operator: '*', args: [simplified, { type: 'Symbol', name: variable }] });
    }

    // Try basic patterns (6A Direct)
    const basic = this.basicRules.matchBasicPattern(simplified, variable, steps);
    if (basic) {
       if (context) context.depth--;
       return basic;
    }

    // Try General U-Substitution (Phase 6B)
    if (!context || !context.activeStrategies.has('6B')) {
       if (context) { context.activeStrategies.add('6B'); context.attemptedStrategies.add('6B'); context.transformationCount++; }
       const subResult = this.substitutionEngine.matchUSubstitution(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6B');
       if (subResult) {
          if (!this.lastSubStep) this.lastSubStep = subResult.subStep;
          if (context) context.depth--;
          return subResult.result;
       }
    }

    // Try Trig Integrals (Phase 6E)
    if (!context || !context.activeStrategies.has('6E')) {
       if (context) { context.activeStrategies.add('6E'); context.attemptedStrategies.add('6E'); context.transformationCount++; }
       const trigResult = this.trigEngine.matchTrigIntegral(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6E');
       if (trigResult) {
          this.trigStepsGlobal.push(...trigResult.trigSteps);
          if (context) context.depth--;
          return trigResult.result;
       }
    }

    // Try Trig Substitution (Phase 6F)
    if (!context || !context.activeStrategies.has('6F')) {
       if (context) { context.activeStrategies.add('6F'); context.attemptedStrategies.add('6F'); context.transformationCount++; }
       const trigSubResult = this.trigSubEngine.matchTrigSub(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6F');
       if (trigSubResult) {
          this.trigSubStepsGlobal.push(trigSubResult.subStep);
          if (context) context.depth--;
          return trigSubResult.result;
       }
    }

    // Try Partial Fractions (Phase 6D)
    if (!context || !context.activeStrategies.has('6D')) {
       if (context) { context.activeStrategies.add('6D'); context.attemptedStrategies.add('6D'); context.transformationCount++; }
       const pfResult = this.pfEngine.matchPartialFractions(simplified, variable, (n: CanonicalAST, v: string, s: MathStep[], d: number) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6D');
       if (pfResult) {
          if (context) context.depth--;
          return pfResult;
       }
    }

    // Try Integration by Parts (Phase 6C)
    if (!context || !context.activeStrategies.has('6C')) {
       if (context) { context.activeStrategies.add('6C'); context.attemptedStrategies.add('6C'); context.transformationCount++; }
       const partsResult = this.partsEngine.matchParts(simplified, variable, (n: CanonicalAST, v: string, s: MathStep[], d: number) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6C');
       if (partsResult) {
          this.partsSteps.push(partsResult.partsStep);
          if (context) context.depth--;
          return partsResult.result;
       }
    }

    if (context) context.depth--;
    throw new Error('Unsupported integral in Phase 6B/6C/6D/6E/6F.');
  }




















}
