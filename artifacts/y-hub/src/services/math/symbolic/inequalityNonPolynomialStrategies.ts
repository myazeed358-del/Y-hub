import { CanonicalAST, InequalityNode } from '../types/ast';
import { SolutionSet, Interval } from '../types/set';

import { PolynomialExtractor } from './polynomial';
import { SymbolicSimplifier } from './simplifier';
import { InequalityTransformationData, MathStep } from '../types/step';
import { SetEngine } from './sets';

import { InequalityAstToolkit } from './inequalityAstToolkit';

interface InequalityStepOptions {
  type?: MathStep['type'];
  details?: Record<string, unknown>;
  transformation?: InequalityTransformationData;
}

export type InequalitySolveResult =
  | { kind: 'solution_set'; solution: SolutionSet; steps: MathStep[] }
  | { kind: 'unsupported'; status: string; steps: MathStep[] };


import { InequalityStepWriter } from './inequalityStepWriter';

/** Absolute-value and radical transformations with controlled recursion. */
export class InequalityNonPolynomialStrategies {
  private extractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  private astToolkit = new InequalityAstToolkit();
  private trace = new InequalityStepWriter();
  constructor(private readonly processNode: (ast: CanonicalAST, variable: string, steps: MathStep[]) => Interval[]) {}
  public solveAbsoluteValueInequality(node: InequalityNode, innerAst: CanonicalAST, targetInnerStr: string, variable: string, steps: MathStep[]): Interval[] {
    const replacedLhs = this.astToolkit.replaceAbsWithSymbol(node.lhs, targetInnerStr);
    const replacedRhs = this.astToolkit.replaceAbsWithSymbol(node.rhs, targetInnerStr);
    const moved = { type: 'Operator', operator: '-', args: [replacedLhs, replacedRhs] };

    const fract = this.astToolkit.fractionalize(moved as CanonicalAST);

    const denPoly = this.extractor.extract(this.simplifier.simplify(fract.den), '___ABS___');
    if (Math.max(...Array.from(denPoly.keys())) > 0) {
      throw new Error('multiple_absolute_values_requires_partitioning');
    }

    const numPoly = this.extractor.extract(this.simplifier.simplify(fract.num), '___ABS___');
    const maxDeg = Math.max(...Array.from(numPoly.keys()));
    if (maxDeg > 1) {
      throw new Error('multiple_absolute_values_requires_partitioning');
    }

    const aTerms = numPoly.get(1) || [];
    const cTerms = numPoly.get(0) || [];

    const aNode = aTerms.length === 0 ? { type: 'Number', value: '0' } : (aTerms.length === 1 ? aTerms[0] : { type: 'Operator', operator: '+', args: aTerms });
    const cNode = cTerms.length === 0 ? { type: 'Number', value: '0' } : (cTerms.length === 1 ? cTerms[0] : { type: 'Operator', operator: '+', args: cTerms });

    const aSimple = this.simplifier.simplify(aNode as CanonicalAST);
    const cSimple = this.simplifier.simplify(cNode as CanonicalAST);

    if (this.astToolkit.containsVariable(aSimple, variable) || this.astToolkit.containsVariable(cSimple, variable)) {
      throw new Error('requires_parameter_sign_analysis');
    }

    let aVal = this.astToolkit.evaluateConstant(aSimple);
    let cVal = this.astToolkit.evaluateConstant(cSimple);

    if (aVal === null || cVal === null) throw new Error('requires_parameter_sign_analysis');

    if (Math.abs(aVal) < 1e-9) {
      return this.astToolkit.evaluateConstantInequality(cSimple, node.operator);
    }

    let boundVal = -cVal / aVal;
    let rel = node.operator;
    if (aVal < 0) {
      rel = this.astToolkit.reverseRelation(rel);
    }

    let boundSign: 'positive' | 'negative' | 'zero' = boundVal > 1e-9 ? 'positive' : (boundVal < -1e-9 ? 'negative' : 'zero');

    const branchEval = (op: string, val: number) => {
      const bAst: InequalityNode = { type: 'Inequality', operator: op as any, lhs: innerAst, rhs: { type: 'Number', value: val.toString() } };
      return this.processNode(bAst, variable, steps);
    };

    let result: Interval[] = [];
    let rule = '';

    if (boundSign === 'positive') {
      if (rel === '<') {
        rule = '|f| < a iff -a < f < a';
        result = SetEngine.intersection(branchEval('>', -boundVal), branchEval('<', boundVal));
      } else if (rel === '<=') {
        rule = '|f| <= a iff -a <= f <= a';
        result = SetEngine.intersection(branchEval('>=', -boundVal), branchEval('<=', boundVal));
      } else if (rel === '>') {
        rule = '|f| > a iff f < -a OR f > a';
        result = SetEngine.union(branchEval('<', -boundVal), branchEval('>', boundVal));
      } else if (rel === '>=') {
        rule = '|f| >= a iff f <= -a OR f >= a';
        result = SetEngine.union(branchEval('<=', -boundVal), branchEval('>=', boundVal));
      } else if (rel === '!=') {
        rule = '|f| != a iff f != a AND f != -a';
        result = SetEngine.intersection(branchEval('!=', boundVal), branchEval('!=', -boundVal));
      }
    } else if (boundSign === 'zero') {
      if (rel === '<') {
        rule = '|f| < 0 is EmptySet';
        result = [];
      } else if (rel === '<=') {
        rule = '|f| <= 0 iff f = 0';
        result = SetEngine.intersection(branchEval('>=', 0), branchEval('<=', 0));
      } else if (rel === '>') {
        rule = '|f| > 0 iff f != 0';
        result = branchEval('!=', 0);
      } else if (rel === '>=') {
        rule = '|f| >= 0 is UniversalSet';
        result = [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      } else if (rel === '!=') {
        rule = '|f| != 0 iff f != 0';
        result = branchEval('!=', 0);
      }
    } else if (boundSign === 'negative') {
      if (rel === '<' || rel === '<=') {
        rule = `|f| ${rel} a < 0 is EmptySet`;
        result = [];
      } else {
        rule = `|f| ${rel} a < 0 is UniversalSet`;
        result = [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      }
    }

    this.trace.appendStep(steps, 'Absolute value transformation', `absolute_value_inequality; bound sign: ${boundSign}. Rule: ${rule}. Isolated absolute value and applied exact piecewise mathematical rules.`, {
      type: 'transformation',
      transformation: {
        method: 'absolute_value_inequality',
        boundSign,
        rule,
        justification: 'Isolated absolute value and applied exact piecewise mathematical rules.'
      }
    });

    return SetEngine.normalizeUnion(result);
  }

  public solveRadicalInequality(node: InequalityNode, innerAst: CanonicalAST, innerStr: string, variable: string, steps: MathStep[]): Interval[] {
    const replacedLhs = this.astToolkit.replaceRadicalWithSymbol(node.lhs, innerStr);
    const replacedRhs = this.astToolkit.replaceRadicalWithSymbol(node.rhs, innerStr);
    const moved = { type: 'Operator', operator: '-', args: [replacedLhs, replacedRhs] };
    const fract = this.astToolkit.fractionalize(moved as CanonicalAST);

    const denPoly = this.extractor.extract(this.simplifier.simplify(fract.den), '___RAD___');
    if (Math.max(...Array.from(denPoly.keys())) > 0) {
      throw new Error('radical_inequality_requires_controlled_squaring');
    }

    const numPoly = this.extractor.extract(this.simplifier.simplify(fract.num), '___RAD___');
    const maxDeg = Math.max(...Array.from(numPoly.keys()));
    if (maxDeg > 1) {
      throw new Error('radical_inequality_requires_controlled_squaring');
    }

    const aTerms = numPoly.get(1) || [];
    const cTerms = numPoly.get(0) || [];

    const aNode = aTerms.length === 0 ? { type: 'Number', value: '0' } : (aTerms.length === 1 ? aTerms[0] : { type: 'Operator', operator: '+', args: aTerms });
    const cNode = cTerms.length === 0 ? { type: 'Number', value: '0' } : (cTerms.length === 1 ? cTerms[0] : { type: 'Operator', operator: '+', args: cTerms });

    const aSimple = this.simplifier.simplify(aNode as CanonicalAST);
    const cSimple = this.simplifier.simplify(cNode as CanonicalAST);

    if (this.astToolkit.containsVariable(aSimple, variable)) {
      throw new Error('requires_parameter_sign_analysis');
    }

    let aVal = this.astToolkit.evaluateConstant(aSimple);
    if (aVal === null) throw new Error('requires_parameter_sign_analysis');

    if (Math.abs(aVal) < 1e-9) {
      return this.astToolkit.evaluateConstantInequality(cSimple, node.operator);
    }

    let rel = node.operator;
    if (aVal < 0) {
      rel = this.astToolkit.reverseRelation(rel);
    }

    // We have: sqrt(A) rel -C / aVal => let B = -C/a
    const bNode: CanonicalAST = {
      type: 'Operator',
      operator: '/',
      args: [
        { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, cSimple] },
        { type: 'Number', value: aVal.toString() }
      ]
    };
    const bSimple = this.simplifier.simplify(bNode);

    // Mandatory Domain: A >= 0
    const aDomainIntervals = this.processNode({ type: 'Inequality', operator: '>=', lhs: innerAst, rhs: { type: 'Number', value: '0' } }, variable, steps);

    const branchEval = (astOp: CanonicalAST, op: string, rhsNode: CanonicalAST) => {
      const bAst: InequalityNode = { type: 'Inequality', operator: op as any, lhs: astOp, rhs: rhsNode };
      return this.processNode(bAst, variable, steps);
    };

    let result: Interval[] = [];

    if (rel === '<' || rel === '<=') {
      // sqrt(A) < B => A >= 0 AND B > 0 (or >= 0 for <=) AND A < B^2
      const bSignIntervals = branchEval(bSimple, rel === '<' ? '>' : '>=', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, rel, { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      result = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bSignIntervals), squaredIntervals);
    } else if (rel === '>' || rel === '>=') {
      // sqrt(A) > B => (B < 0 AND A >= 0) OR (B >= 0 AND A > B^2)
      const bNegIntervals = branchEval(bSimple, rel === '>' ? '<' : '<=', { type: 'Number', value: '0' });
      const branch1 = SetEngine.intersection(bNegIntervals, aDomainIntervals);

      const bPosIntervals = branchEval(bSimple, rel === '>' ? '>=' : '>', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, rel, { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      const branch2 = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bPosIntervals), squaredIntervals);

      result = SetEngine.union(branch1, branch2);
    } else if (rel === '!=') {
      // sqrt(A) != B => (B < 0 AND A >= 0) OR (B >= 0 AND A != B^2)
      const bNegIntervals = branchEval(bSimple, '<', { type: 'Number', value: '0' });
      const branch1 = SetEngine.intersection(bNegIntervals, aDomainIntervals);

      const bPosIntervals = branchEval(bSimple, '>=', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, '!=', { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      const branch2 = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bPosIntervals), squaredIntervals);

      result = SetEngine.union(branch1, branch2);
    }

    this.trace.appendStep(steps, 'Radical inequality resolved via safe squaring', `radical_squaring for ${rel}. Isolated radical and applied sign-checked squaring conditions, preserving A >= 0.`, {
      type: 'transformation',
      transformation: {
        method: 'radical_squaring',
        relation: rel,
        justification: 'Isolated radical and applied sign-checked squaring conditions, preserving A >= 0.'
      }
    });

    return result;
  }
}
