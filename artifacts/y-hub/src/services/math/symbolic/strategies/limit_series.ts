import { CanonicalAST } from '../../types/ast';
import { LimitApproach, LimitDirection } from '../../types/limit';
import { TransformationData } from '../../types/step';
import { LimitStrategy } from './limit_algebra';
import { LocalSeriesEngine, Rat, Rational } from '../series';

export class SeriesLimitStrategy implements LimitStrategy {
  private engine = new LocalSeriesEngine();
  
  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    if (typeof approach !== 'number') return null;
    
    let num = ast;
    let den: CanonicalAST = { type: 'Number', value: '1' };
    if (ast.type === 'Operator' && ast.operator === '/') {
      num = ast.args[0];
      den = ast.args[1];
    }

    const MAX_ORDER = 15;
    for (let order = 3; order <= MAX_ORDER; order += 2) {
      const sNum = this.engine.expand(num, variable, approach, order);
      const sDen = this.engine.expand(den, variable, approach, order);
      
      if (!sNum || !sDen) return null;
      
      const leadNum = sNum.terms.findIndex(v => !Rat.isZero(v));
      const leadDen = sDen.terms.findIndex(v => !Rat.isZero(v));
      
      if (leadNum === -1 || leadDen === -1) {
        if (order >= MAX_ORDER) return null; // series_order_limit_reached
        continue;
      }
      
      const m = leadNum;
      const n = leadDen;
      const cn = sNum.terms[m];
      const cd = sDen.terms[n];
      
      let after: CanonicalAST;
      
      const ratio = Rat.div(cn, cd);
      
      if (m >= n) {
        after = this.buildTerm(ratio, m - n, variable, approach);
      } else {
        const ratioStr = ratio.den === 1n ? ratio.num.toString() : `${ratio.num}/${ratio.den}`;
        after = {
          type: 'Operator',
          operator: '/',
          args: [
            { type: 'Number', value: ratioStr },
            this.buildTerm(Rat.one, n - m, variable, approach)
          ]
        };
      }
      
      return {
        method: 'taylor_series_limit',
        before: ast,
        after,
        restrictionsAdded: [],
        justification: `Resolved using local series expansion up to order ${order}. Leading terms: ${m} (num) and ${n} (den).`,
        verified: 'limit_preserving_series' as any
      };
    }
    return null;
  }
  
  private buildTerm(c: Rational, degree: number, variable: string, center: number): CanonicalAST {
    const cStr = c.den === 1n ? c.num.toString() : `${c.num}/${c.den}`;
    
    // Evaluate if this exact rational division parses easily by simplifier, 
    // actually returning it as a division operator might be safer if the simplifier doesn't parse "1/6" as number.
    let coeffAST: CanonicalAST;
    if (c.den === 1n) {
      coeffAST = { type: 'Number', value: c.num.toString() };
    } else if (c.num < 0n) {
      coeffAST = {
        type: 'Operator',
        operator: '*',
        args: [
          { type: 'Number', value: '-1' },
          {
            type: 'Operator',
            operator: '/',
            args: [
              { type: 'Number', value: (-c.num).toString() },
              { type: 'Number', value: c.den.toString() }
            ]
          }
        ]
      };
    } else {
      coeffAST = {
        type: 'Operator',
        operator: '/',
        args: [
          { type: 'Number', value: c.num.toString() },
          { type: 'Number', value: c.den.toString() }
        ]
      };
    }

    if (degree === 0) return coeffAST;
    
    let varAST: CanonicalAST = { type: 'Symbol', name: variable };
    if (center !== 0) {
      varAST = { type: 'Operator', operator: '-', args: [varAST, { type: 'Number', value: center.toString() }] };
    }
    
    const powAST: CanonicalAST = degree === 1 ? varAST : { type: 'Operator', operator: '^', args: [varAST, { type: 'Number', value: degree.toString() }] };
    
    if (Rat.isEqual(c, Rat.one)) return powAST;
    if (Rat.isEqual(c, { num: -1n, den: 1n })) return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, powAST] };
    
    return { type: 'Operator', operator: '*', args: [coeffAST, powAST] };
  }
}
