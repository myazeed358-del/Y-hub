import { CanonicalAST, InequalityNode } from '../types/ast';
import { SolutionSet, Interval } from '../types/set';

import { PolynomialExtractor } from './polynomial';
import { SymbolicSimplifier } from './simplifier';
import { InequalityTransformationData, MathStep } from '../types/step';
import { SetEngine } from './sets';
import { DomainAnalyzer } from '../domain';
import { InequalityAstToolkit } from './inequalityAstToolkit';
import { InequalitySignStrategies } from './inequalitySignStrategies';
import { InequalityNonPolynomialStrategies } from './inequalityNonPolynomialStrategies';

interface InequalityStepOptions {
  type?: MathStep['type'];
  details?: Record<string, unknown>;
  transformation?: InequalityTransformationData;
}

export type InequalitySolveResult =
  | { kind: 'solution_set'; solution: SolutionSet; steps: MathStep[] }
  | { kind: 'unsupported'; status: string; steps: MathStep[] };

export class InequalityEngine {
  private readonly signStrategies = new InequalitySignStrategies();
  private readonly nonPolynomialStrategies = new InequalityNonPolynomialStrategies(
    (ast, variable, steps) => this.processNode(ast, variable, steps)
  );
  private readonly astToolkit = new InequalityAstToolkit();
  private extractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  private domainAnalyzer = new DomainAnalyzer();

  public solve(ast: CanonicalAST, variable: string): InequalitySolveResult {
    const steps: MathStep[] = [];

    let intervals: Interval[];
    try {
      intervals = this.processNode(ast, variable, steps);
    } catch (e: any) {
      if (e.message === 'requires_parameter_sign_analysis' || e.message === 'root_isolation_incomplete' || e.message === 'radical_inequality_requires_controlled_squaring' || e.message === 'multiple_absolute_values_requires_partitioning' || e.message === 'nested_absolute_value_requires_branch_solver') {
        return { kind: 'unsupported', status: e.message, steps };
      }
      throw e;
    }

    // Domain analysis integration
    const domainReqs = this.domainAnalyzer.analyze(ast);
    const domainRestrictions: string[] = [];

    if (domainReqs && domainReqs.length > 0) {
      for (const req of domainReqs) {
        let reqRelation = '';
        if (req.type === 'denominator') reqRelation = '!=';
        else if (req.type === 'even_root') reqRelation = '>=';
        else if (req.type === 'logarithm') reqRelation = '>';

        if (reqRelation) {
          const constraintNode: InequalityNode = {
            type: 'Inequality',
            operator: reqRelation as any,
            lhs: req.conditionAST,
            rhs: { type: 'Number', value: '0' }
          };

          try {
            const reqIntervals = this.signStrategies.solveLinearInequality(constraintNode, variable, steps);
            intervals = SetEngine.intersection(intervals, reqIntervals);
            domainRestrictions.push(`${req.type} constraint solved and intersected`);
          } catch (e) {
             domainRestrictions.push(`Unsolved ${req.type} constraint: ${req.message}`);
          }
        }
      }
    }

    return {
      kind: 'solution_set',
      solution: {
        type: 'SolutionSet',
        variable,
        intervals,
        domainRestrictions
      },
      steps
    };
  }

  private processNode(ast: CanonicalAST, variable: string, steps: MathStep[]): Interval[] {
    if (ast.type === 'Function' && (ast.name.toUpperCase() === 'AND' || ast.name.toUpperCase() === 'OR')) {
      const branches = ast.args.map(arg => this.processNode(arg, variable, steps));
      const op = ast.name.toUpperCase();
      let result = branches[0];
      for (let i = 1; i < branches.length; i++) {
        result = op === 'AND' ? SetEngine.intersection(result, branches[i]) : SetEngine.union(result, branches[i]);
      }
      return result;
    }

    if (ast.type === 'Inequality') {
      const absNodes = this.astToolkit.findAbsNodes(ast);
      if (absNodes.length > 0) {
        if (absNodes.some(n => this.astToolkit.hasNestedAbs(n))) {
          throw new Error('nested_absolute_value_requires_branch_solver');
        }
        const uniqueInners = new Set(absNodes.map(n => JSON.stringify(n.type === 'Operator' ? n.args[0] : (n as any).args[0])));
        if (uniqueInners.size > 1) {
          throw new Error('multiple_absolute_values_requires_partitioning');
        }
        const targetInnerStr = Array.from(uniqueInners)[0];
        const innerAst = JSON.parse(targetInnerStr) as CanonicalAST;
        return this.nonPolynomialStrategies.solveAbsoluteValueInequality(ast as InequalityNode, innerAst, targetInnerStr, variable, steps);
      }

      const radicalNodes = this.astToolkit.findRadicalNodes(ast);
      if (radicalNodes.length > 0) {
        if (radicalNodes.length > 1) {
          throw new Error('radical_inequality_requires_controlled_squaring');
        }
        const innerAst = (radicalNodes[0] as any).args[0] as CanonicalAST;
        const innerStr = JSON.stringify(innerAst);
        return this.nonPolynomialStrategies.solveRadicalInequality(ast as InequalityNode, innerAst, innerStr, variable, steps);
      }

      try {
        const moved = { type: 'Operator', operator: '-', args: [ast.lhs, ast.rhs] };
        const simplifiedMoved = this.simplifier.simplify(moved as CanonicalAST);
        // Try polynomial extraction first to avoid fractionalization overhead if it's simple
        const poly = this.extractor.extract(simplifiedMoved, variable);
        const maxDeg = poly.size === 0 ? 0 : Math.max(...Array.from(poly.keys()));
        if (maxDeg > 1) {
          return this.signStrategies.solvePolynomialInequality(poly, ast.operator, variable, steps);
        }
        return this.signStrategies.solveLinearInequality(ast, variable, steps);
      } catch (e: any) {
        if (e.message === 'root_isolation_incomplete' || e.message === 'requires_parameter_sign_analysis') {
          throw e;
        }
        // Fallback to Rational Solver for anything else (e.g. variable in denominator)
        return this.signStrategies.solveRationalInequality(ast as InequalityNode, variable, steps);
      }
    }
    return [];
  }


}
