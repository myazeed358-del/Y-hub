import { CanonicalAST } from '../types/ast';
import { LimitApproach, LimitDirection } from '../types/limit';
import { IndeterminateForm } from '../types/result';
import { ASTEvaluator } from './evaluator';

export type LimitVal = 
  | { type: 'finite', value: number }
  | { type: 'infinity', sign: 1 | -1 | 0 } // 0 means unsigned/divergent
  | { type: 'indeterminate', form: IndeterminateForm }
  | { type: 'undefined' };

export class LimitEvaluator {
  private numEvaluator = new ASTEvaluator();

  public evaluateForm(node: CanonicalAST, variable: string, approach: LimitApproach, direction: 'left' | 'right'): LimitVal {
    switch (node.type) {
      case 'Number':
        return { type: 'finite', value: parseFloat((node as any).value) };
      case 'Symbol':
        if (node.name === variable) {
          if (approach === '+infinity') return { type: 'infinity', sign: 1 };
          if (approach === '-infinity') return { type: 'infinity', sign: -1 };
          return { type: 'finite', value: approach as number };
        }
        // Unrecognized symbols treated as constants (for now, assume 1 or throw. Keep it simple and assume no other symbols)
        return { type: 'finite', value: 1 };
      case 'Operator':
        return this.evalOperator(node.operator, node.args, variable, approach, direction, node);
      case 'Function':
        return this.evalFunction(node.name, node.args, variable, approach, direction, node);
      case 'Parenthesis':
        return this.evaluateForm(node.content, variable, approach, direction);
      default:
        return { type: 'undefined' };
    }
  }

  private evalOperator(op: string, args: CanonicalAST[], variable: string, approach: LimitApproach, direction: 'left' | 'right', originalNode: CanonicalAST): LimitVal {
    const vals = args.map(arg => this.evaluateForm(arg, variable, approach, direction));

    if (vals.some(v => v.type === 'undefined')) return { type: 'undefined' };
    
    const indeterminate = vals.find(v => v.type === 'indeterminate');
    if (indeterminate) return indeterminate;

    if (op === '+') {
      let sum = 0;
      let infSign = 0;
      for (const v of vals) {
        if (v.type === 'finite') sum += v.value;
        if (v.type === 'infinity') {
          if (infSign === 0) infSign = v.sign;
          else if (infSign !== v.sign && v.sign !== 0) return { type: 'indeterminate', form: 'inf-inf' };
        }
      }
      if (infSign !== 0) return { type: 'infinity', sign: infSign as 1 | -1 | 0 };
      return { type: 'finite', value: sum };
    }

    if (op === '-') {
      const v1 = vals[0];
      const v2 = vals[1];
      if (v1.type === 'infinity' && v2.type === 'infinity' && v1.sign === v2.sign && v1.sign !== 0) return { type: 'indeterminate', form: 'inf-inf' };
      if (v1.type === 'infinity') return v1;
      if (v2.type === 'infinity') return { type: 'infinity', sign: -v2.sign as 1 | -1 | 0 };
      if (v1.type === 'finite' && v2.type === 'finite') return { type: 'finite', value: v1.value - v2.value };
    }

    if (op === '*' || op === 'implicit_multiply') {
      let prod = 1;
      let hasInf = false;
      let hasZero = false;
      for (const v of vals) {
        if (v.type === 'finite') {
          if (Math.abs(v.value) < 1e-10) hasZero = true;
          else prod *= v.value;
        }
        if (v.type === 'infinity') {
          hasInf = true;
          if (v.sign === 0) prod = 0; // Unsigned propagates
          else prod *= v.sign;
        }
      }
      if (hasZero && hasInf) return { type: 'indeterminate', form: '0*inf' };
      if (hasInf) return { type: 'infinity', sign: Math.sign(prod) as 1 | -1 | 0 };
      if (hasZero) return { type: 'finite', value: 0 };
      return { type: 'finite', value: prod };
    }

    if (op === '/') {
      const n = vals[0];
      const d = vals[1];

      if (n.type === 'finite' && Math.abs(n.value) < 1e-10 && d.type === 'finite' && Math.abs(d.value) < 1e-10) return { type: 'indeterminate', form: '0/0' };
      if (n.type === 'infinity' && d.type === 'infinity') return { type: 'indeterminate', form: 'inf/inf' };
      if (n.type === 'finite' && d.type === 'infinity') return { type: 'finite', value: 0 };
      
      if (d.type === 'finite' && Math.abs(d.value) < 1e-10) {
        // finite / 0  => Infinity. We need the sign of D to determine if +inf or -inf.
        const probeD = this.numericProbe(args[1], variable, approach, direction);
        if (probeD === 0 || isNaN(probeD)) return { type: 'undefined' };
        
        let nSign = 1;
        if (n.type === 'finite') nSign = Math.sign(n.value);
        else if (n.type === 'infinity') nSign = n.sign;

        return { type: 'infinity', sign: (nSign * Math.sign(probeD)) as 1 | -1 | 0 };
      }
      
      if (n.type === 'infinity' && d.type === 'finite') return { type: 'infinity', sign: (n.sign * Math.sign(d.value)) as 1 | -1 | 0 };
      if (n.type === 'finite' && d.type === 'finite') return { type: 'finite', value: n.value / d.value };
    }

    if (op === '^') {
      const b = vals[0];
      const e = vals[1];

      if (b.type === 'finite' && Math.abs(b.value) < 1e-10 && e.type === 'finite' && Math.abs(e.value) < 1e-10) return { type: 'indeterminate', form: '0^0' };
      if (b.type === 'finite' && Math.abs(b.value - 1) < 1e-10 && e.type === 'infinity') return { type: 'indeterminate', form: '1^inf' };
      if (b.type === 'infinity' && e.type === 'finite' && Math.abs(e.value) < 1e-10) return { type: 'indeterminate', form: 'inf^0' };

      if (b.type === 'finite' && e.type === 'finite') {
        const val = Math.pow(b.value, e.value);
        return isNaN(val) ? { type: 'undefined' } : { type: 'finite', value: val };
      }

      // 0 ^ pos = 0, 0 ^ neg = inf
      if (b.type === 'finite' && Math.abs(b.value) < 1e-10) {
        if (e.type === 'finite') return e.value > 0 ? { type: 'finite', value: 0 } : { type: 'infinity', sign: 1 }; // simplifying 1/0 as +inf for powers of 0 generally, though sign may vary for odd roots of negatives.
      }

      // inf ^ pos = inf, inf ^ neg = 0
      if (b.type === 'infinity') {
        if (e.type === 'finite') return e.value > 0 ? { type: 'infinity', sign: b.sign } : { type: 'finite', value: 0 };
      }
    }

    return { type: 'undefined' };
  }

  private evalFunction(name: string, args: CanonicalAST[], variable: string, approach: LimitApproach, direction: 'left' | 'right', node: CanonicalAST): LimitVal {
    const inner = this.evaluateForm(args[0], variable, approach, direction);
    if (inner.type === 'undefined' || inner.type === 'indeterminate') return inner;

    if (name === 'sin' || name === 'cos') {
      if (inner.type === 'infinity') return { type: 'undefined' }; // Oscillates
      return { type: 'finite', value: name === 'sin' ? Math.sin((inner as any).value) : Math.cos((inner as any).value) };
    }
    
    if (name === 'sqrt') {
      if (inner.type === 'finite') {
        if (inner.value < 0) return { type: 'undefined' };
        return { type: 'finite', value: Math.sqrt(inner.value) };
      }
      if (inner.type === 'infinity') return inner.sign === 1 ? { type: 'infinity', sign: 1 } : { type: 'undefined' };
    }

    if (name === 'exp') {
      if (inner.type === 'finite') return { type: 'finite', value: Math.exp(inner.value) };
      if (inner.type === 'infinity') return inner.sign === 1 ? { type: 'infinity', sign: 1 } : { type: 'finite', value: 0 };
    }

    if (name === 'ln' || name === 'log') {
      if (inner.type === 'finite') {
        if (inner.value < 0) return { type: 'undefined' };
        if (inner.value === 0) return { type: 'infinity', sign: -1 };
        return { type: 'finite', value: Math.log(inner.value) };
      }
      if (inner.type === 'infinity') return inner.sign === 1 ? { type: 'infinity', sign: 1 } : { type: 'undefined' };
    }

    if (name === 'abs') {
      if (inner.type === 'finite') return { type: 'finite', value: Math.abs(inner.value) };
      if (inner.type === 'infinity') return { type: 'infinity', sign: 1 };
    }

    // Default evaluate numerical
    const probe = this.numericProbe(node, variable, approach, direction);
    if (isNaN(probe)) return { type: 'undefined' };
    return { type: 'finite', value: probe };
  }

  private numericProbe(node: CanonicalAST, variable: string, approach: LimitApproach, direction: 'left' | 'right'): number {
    let probePoint = 0;
    const delta = 1e-8;
    
    if (approach === '+infinity') probePoint = 1e8;
    else if (approach === '-infinity') probePoint = -1e8;
    else {
      probePoint = direction === 'right' ? approach + delta : approach - delta;
    }
    
    try {
      return this.numEvaluator.evaluate(node, { [variable]: probePoint });
    } catch {
      return NaN;
    }
  }
}
