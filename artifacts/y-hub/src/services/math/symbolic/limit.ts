import { CanonicalAST } from '../types/ast';
import { LimitRequest, LimitDirection } from '../types/limit';
import { LimitResult, LimitClassification } from '../types/result';
import { MathStep } from '../types/step';
import { DomainAnalyzer } from '../domain';
import { LimitEvaluator, LimitVal } from './limitEvaluator';
import { SymbolicSimplifier } from './simplifier';
import { ASTUtils } from './utils';
import { 
  FactoringStrategy, 
  RationalizationStrategy, 
  AbsoluteValueLimitStrategy,
  InfinitePolynomialStrategy,
  InfiniteRationalStrategy,
  RadicalAsymptoticStrategy
} from './strategies/limit_algebra';
import { TrigonometricLimitStrategy } from './strategies/limit_trig';
import { ExponentialFormStrategy, ProductRearrangementStrategy } from './strategies/limit_exp_log';
import { SeriesLimitStrategy } from './strategies/limit_series';
import { LHopitalStrategy } from './strategies/limit_lhopital';

export class LimitEngine {
  private domainAnalyzer = new DomainAnalyzer();
  private evaluator = new LimitEvaluator();
  private simplifier = new SymbolicSimplifier();
  
  private algebraicStrategies = [
    new AbsoluteValueLimitStrategy(),
    new TrigonometricLimitStrategy(),
    new ExponentialFormStrategy(),
    new ProductRearrangementStrategy(),
    new RationalizationStrategy(),
    new FactoringStrategy(),
    new SeriesLimitStrategy()
  ];

  private asymptoticStrategies = [
    new RadicalAsymptoticStrategy(),
    new RationalizationStrategy(),
    new InfiniteRationalStrategy(),
    new InfinitePolynomialStrategy(),
    new AbsoluteValueLimitStrategy(),
    new TrigonometricLimitStrategy(),
    new ExponentialFormStrategy(),
    new ProductRearrangementStrategy(),
    new FactoringStrategy(),
    new SeriesLimitStrategy()
  ];

  private lHopitalStrategy = new LHopitalStrategy();

  public evaluateLimit(req: LimitRequest, steps: MathStep[] = []): LimitResult {
    // 1. Two-sided delegation
    if (req.direction === 'both' && req.approach !== '+infinity' && req.approach !== '-infinity') {
      const leftSteps: MathStep[] = [];
      const rightSteps: MathStep[] = [];
      
      const leftRes = this.evaluateLimit({ ...req, direction: 'left' }, leftSteps);
      const rightRes = this.evaluateLimit({ ...req, direction: 'right' }, rightSteps);
      
      steps.push({
        id: `two_sided_split_${Date.now()}`,
        title: 'Two-Sided Limit Analysis',
        explanation: 'Evaluating left and right limits independently.',
        subSteps: [
          { id: 'left_branch', title: 'Left Limit (x -> a-)', explanation: `Result: ${leftRes.classification}`, subSteps: leftSteps },
          { id: 'right_branch', title: 'Right Limit (x -> a+)', explanation: `Result: ${rightRes.classification}`, subSteps: rightSteps }
        ]
      });

      if (leftRes.classification === 'finite' && rightRes.classification === 'finite') {
        if (leftRes.value && rightRes.value && leftRes.value.type === 'Number' && rightRes.value.type === 'Number' && leftRes.value.value === rightRes.value.value) {
          return { ...leftRes, direction: 'both', steps };
        } else {
          return { ...leftRes, classification: 'does_not_exist', value: undefined, direction: 'both', steps, strategy: 'one_sided_mismatch' };
        }
      }
      
      if (leftRes.classification === '+infinity' && rightRes.classification === '+infinity') {
        return { ...leftRes, direction: 'both', steps };
      }
      if (leftRes.classification === '-infinity' && rightRes.classification === '-infinity') {
        return { ...leftRes, direction: 'both', steps };
      }

      if (leftRes.classification === 'indeterminate' && rightRes.classification === 'indeterminate' && leftRes.indeterminateForm === rightRes.indeterminateForm) {
        return { ...leftRes, direction: 'both', steps, classification: 'indeterminate' };
      }

      return {
        type: 'limit',
        classification: 'does_not_exist',
        indeterminateForm: 'none',
        direction: 'both',
        approachPoint: req.approach,
        strategy: 'one_sided_mismatch',
        conditions: [...new Set([...leftRes.conditions, ...rightRes.conditions])],
        steps,
        warnings: [],
        engineUsed: 'local_ts'
      };
    }

    // 2. Standard single-direction pipeline
    steps.push({
      id: `limit_domain_${Date.now()}`,
      title: 'Domain Analysis',
      explanation: 'Check for singularities and branch restrictions.'
    });

    const restrictions = this.domainAnalyzer.analyze(req.expression);
    let conditions = restrictions.map(r => r.description);
    let warnings: string[] = [];

    let currentExpr = req.expression;
    let classification: LimitClassification = 'not_proven';
    let indeterminateForm: any = 'none';
    let valueAST: CanonicalAST | undefined;
    let finalStrategy = 'direct_substitution';
    
    const simplifiedExpr = this.simplifier.simplify(req.expression);
    if (!ASTUtils.structuralEquals(simplifiedExpr, req.expression)) {
      currentExpr = simplifiedExpr;
      steps.push({
         id: `initial_simplification_${Date.now()}`,
         title: 'Algebraic Normalization',
         explanation: 'Simplified the original expression structurally.'
      });
    }

    const strategiesToUse = (req.approach === '+infinity' || req.approach === '-infinity') 
      ? this.asymptoticStrategies 
      : this.algebraicStrategies;

    let lhopitalCount = 0;
    const MAX_LHOPITAL = 3;

    for (let iter = 0; iter < 10; iter++) {
      const res = this.evalExpression(currentExpr, req);
      classification = res.classification;
      indeterminateForm = res.indeterminateForm;
      valueAST = res.valueAST;

      if (classification === 'finite' || classification === '+infinity' || classification === '-infinity' || classification === 'undefined' || classification === 'does_not_exist') {
        if (iter === 0) {
          steps.push({
            id: `limit_classification_${iter}`,
            title: 'Direct Substitution',
            explanation: `Attempted direct substitution. Classified as ${classification}.`
          });
        } else {
          steps.push({
            id: `limit_classification_${iter}`,
            title: 'Re-evaluation',
            explanation: `Evaluated transformed expression. Classified as ${classification}.`
          });
        }
        break; 
      }
      
      if (classification === 'indeterminate') {
        if (iter === 0) {
          steps.push({
            id: `limit_classification_${iter}`,
            title: 'Direct Substitution',
            explanation: `Attempted direct substitution. Detected Indeterminate Form: ${indeterminateForm}.`
          });
        }

        let transformed = false;
        
        for (const strategy of strategiesToUse) {
          const transformation = strategy.apply(currentExpr, req.variable, req.approach, req.direction);
          if (transformation) {
            currentExpr = transformation.after;
            conditions.push(...transformation.restrictionsAdded);
            steps.push({
              id: `transform_${iter}_${Date.now()}`,
              title: `Algebraic Transformation: ${transformation.method}`,
              explanation: transformation.justification,
              transformation
            });
            
            if (transformation.method === 'standard_trigonometric_limit') {
              finalStrategy = 'standard_trigonometric_limit';
            } else if (transformation.method === 'exponential_logarithmic_transformation') {
              finalStrategy = 'exponential_logarithmic_transformation';
            } else if (transformation.method === 'taylor_series_limit') {
              finalStrategy = 'taylor_series_limit';
            } else {
              finalStrategy = (req.approach === '+infinity' || req.approach === '-infinity') ? 'asymptotic_analysis' : 'algebraic_resolution';
            }
            
            transformed = true;
            break; 
          }
        }
        
        if (!transformed) {
          if (['0*inf', 'inf-inf'].includes(indeterminateForm)) {
            warnings.push('requires_algebraic_rearrangement');
            classification = 'unsupported';
            break;
          }

          if (lhopitalCount < MAX_LHOPITAL) {
            const trans = this.lHopitalStrategy.apply(currentExpr, req.variable, req.approach, req.direction);
            if (trans) {
              currentExpr = trans.after;
              conditions.push(...trans.restrictionsAdded);
              steps.push({
                id: `lhopital_${iter}_${Date.now()}`,
                title: 'L\'Hôpital\'s Rule',
                explanation: trans.justification,
                transformation: trans
              });
              lhopitalCount++;
              finalStrategy = 'l_hopital';
              transformed = true;
            } else {
              if (['0^0', '1^inf', 'inf^0'].includes(indeterminateForm)) {
                 warnings.push('requires_exponential_form_strategy');
              } else {
                 warnings.push('l_hopital_applicability_check_failed');
              }
              classification = 'unsupported';
              break;
            }
          } else {
            classification = 'unsupported';
            warnings.push('l_hopital_iteration_limit_reached');
            break;
          }
        }

        if (!transformed) break;
      }
    }

    return {
      type: 'limit',
      classification,
      indeterminateForm,
      direction: req.direction,
      approachPoint: req.approach,
      strategy: finalStrategy,
      value: valueAST,
      conditions: [...new Set(conditions)],
      steps,
      warnings,
      engineUsed: 'local_ts',
    };
  }

  private evalExpression(expr: CanonicalAST, req: LimitRequest): { classification: LimitClassification, indeterminateForm: any, valueAST?: CanonicalAST } {
    let classification: LimitClassification = 'not_proven';
    let indeterminateForm: any = 'none';
    let valueAST: CanonicalAST | undefined;

    const res = this.evaluator.evaluateForm(expr, req.variable, req.approach, req.direction);
    if (res.type === 'finite') {
      classification = 'finite';
      
      // Attempt to preserve exact symbolic rational value if expr is free of variables
      if (!this.hasVariable(expr, req.variable)) {
        valueAST = this.simplifier.simplify(expr);
      } else {
        valueAST = { type: 'Number', value: res.value.toString() };
      }
    } else if (res.type === 'infinity') {
      classification = res.sign === 1 ? '+infinity' : '-infinity';
      valueAST = res.sign === 1 ? { type: 'Constant', name: 'Infinity' } : { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Constant', name: 'Infinity' }] };
    } else if (res.type === 'indeterminate') {
      classification = 'indeterminate';
      indeterminateForm = res.form;
    } else if (res.type === 'undefined') {
      classification = 'undefined';
    }

    return { classification, indeterminateForm, valueAST };
  }

  private hasVariable(ast: CanonicalAST, variable: string): boolean {
    if (ast.type === 'Symbol' && ast.name === variable) return true;
    if (ast.type === 'Operator' || ast.type === 'Function') {
      return (ast as any).args.some((a: CanonicalAST) => this.hasVariable(a, variable));
    }
    if (ast.type === 'Parenthesis') return this.hasVariable((ast as any).content, variable);
    return false;
  }
}
