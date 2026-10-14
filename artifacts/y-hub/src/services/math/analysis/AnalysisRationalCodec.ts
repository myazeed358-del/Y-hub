import { CanonicalAST } from '../types/ast';
import { Rat } from '../utils/rational';

/** Shared exact rational conversion for function-analysis stages. */
export class AnalysisRationalCodec {
public astToRational(ast: CanonicalAST): { num: bigint, den: bigint } | null {
    if (ast.type === 'Number') return Rat.fromString(ast.value);
    if (ast.type === 'Operator' && ast.operator === '/') {
      const numR = this.astToRational(ast.args[0]);
      const denR = this.astToRational(ast.args[1]);
      if (numR && denR) return Rat.div(numR, denR);
    }
    if (ast.type === 'Operator' && ast.operator === '*') {
      if (ast.args[0].type === 'Number' && ast.args[0].value === '-1') {
         const val = this.astToRational(ast.args[1]);
         if (val) return { num: -val.num, den: val.den };
      }
    }
    return null;
  }
}
