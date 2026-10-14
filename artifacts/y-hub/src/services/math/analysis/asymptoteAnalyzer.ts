import type { CanonicalAST } from '../types/ast';
import type { Asymptote, InfiniteBehavior, DiscontinuityPoint } from '../types/analysis';
import { LimitEngine } from '../symbolic/limit';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { PolynomialExtractor } from '../symbolic/polynomial';

/** Calculates vertical, horizontal and exact polynomial slant asymptotes. */
export class AsymptoteAnalyzer {
  private readonly limitEngine = new LimitEngine();
  private readonly simplifier = new SymbolicSimplifier();
public analyze(ast: CanonicalAST, variable: string, discontinuities: DiscontinuityPoint[]): { asymptotes: Asymptote[], infiniteBehavior: InfiniteBehavior } {
    const asymptotes: Asymptote[] = [];

    // Vertical Asymptotes
    for (const d of discontinuities) {
       if (d.status === 'infinite_discontinuity' && d.point.type === 'value') {
          asymptotes.push({ type: 'vertical', equation: { type: 'Equation', lhs: { type: 'Symbol', name: variable }, rhs: d.point.ast } });
       }
    }

    // Horizontal Asymptotes & Infinite Behavior
    let limitAtPlusInfinity: any = 'does_not_exist';
    let limitAtMinusInfinity: any = 'does_not_exist';

    try {
       const lPlus = this.limitEngine.evaluateLimit({ expression: ast, variable, approach: '+infinity', direction: 'both' });
       if (lPlus.type === 'limit') {
          limitAtPlusInfinity = lPlus.value;
          if (lPlus.classification === 'finite' && lPlus.value) {
             asymptotes.push({ type: 'horizontal', equation: { type: 'Equation', lhs: { type: 'Symbol', name: 'y' }, rhs: lPlus.value }, direction: '+infinity' });
          }
       }
    } catch { limitAtPlusInfinity = 'unresolved'; }

    try {
       const lMinus = this.limitEngine.evaluateLimit({ expression: ast, variable, approach: '-infinity', direction: 'both' });
       if (lMinus.type === 'limit') {
          limitAtMinusInfinity = lMinus.value;
          if (lMinus.classification === 'finite' && lMinus.value) {
             asymptotes.push({ type: 'horizontal', equation: { type: 'Equation', lhs: { type: 'Symbol', name: 'y' }, rhs: lMinus.value }, direction: '-infinity' });
          }
       }
    } catch { limitAtMinusInfinity = 'unresolved'; }

    // Slant asymptotes
    //
    // For P(x)/Q(x), a linear slant asymptote exists when
    // deg(P) = deg(Q) + 1.
    //
    // Compute the first two quotient coefficients exactly:
    //
    //   m = p_n / q_m
    //   b = (p_(n-1) - m*q_(m-1)) / q_m
    //
    // so the asymptote is y = m*x + b.
    if (
      ast.type === 'Operator' &&
      ast.operator === '/'
    ) {
      try {
        const polyExt =
          new PolynomialExtractor();

        const numMap =
          polyExt.extract(
            ast.args[0],
            variable
          ) as Map<number, CanonicalAST[]>;

        const denMap =
          polyExt.extract(
            ast.args[1],
            variable
          ) as Map<number, CanonicalAST[]>;

        const numDegrees =
          Array.from(numMap.keys());

        const denDegrees =
          Array.from(denMap.keys());

        const coefficientAt = (
          map: Map<number, CanonicalAST[]>,
          degree: number
        ): CanonicalAST => {
          const terms =
            map.get(degree) ?? [];

          if (terms.length === 0) {
            return {
              type: 'Number',
              value: '0'
            };
          }

          if (terms.length === 1) {
            return terms[0];
          }

          return this.simplifier.simplify({
            type: 'Operator',
            operator: '+',
            args: terms
          });
        };

        if (
          numDegrees.length > 0 &&
          denDegrees.length > 0
        ) {
          const maxNum =
            Math.max(...numDegrees);

          const maxDen =
            Math.max(...denDegrees);

          if (maxNum === maxDen + 1) {
            const pLead =
              coefficientAt(
                numMap,
                maxNum
              );

            const qLead =
              coefficientAt(
                denMap,
                maxDen
              );

            const pNext =
              coefficientAt(
                numMap,
                maxNum - 1
              );

            const qNext =
              coefficientAt(
                denMap,
                maxDen - 1
              );

            const m =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [
                  pLead,
                  qLead
                ]
              });

            const mTimesQNext =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '*',
                args: [
                  m,
                  qNext
                ]
              });

            const bNumerator =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '-',
                args: [
                  pNext,
                  mTimesQNext
                ]
              });

            const b =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [
                  bNumerator,
                  qLead
                ]
              });

            const mx =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '*',
                args: [
                  m,
                  {
                    type: 'Symbol',
                    name: variable
                  }
                ]
              });

            const slantRhs =
              this.simplifier.simplify({
                type: 'Operator',
                operator: '+',
                args: [
                  mx,
                  b
                ]
              });

            asymptotes.push({
              type: 'slant',
              equation: {
                type: 'Equation',
                lhs: {
                  type: 'Symbol',
                  name: 'y'
                },
                rhs: slantRhs
              }
            });
          }
        }
      } catch {
        // Non-polynomial rational structure:
        // no exact slant asymptote is inferred here.
      }
    }

    return { asymptotes, infiniteBehavior: { limitAtPlusInfinity, limitAtMinusInfinity } };
  }
}
