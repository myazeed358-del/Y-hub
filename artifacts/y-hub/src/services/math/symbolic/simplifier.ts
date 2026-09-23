import { CanonicalAST } from '../types/ast';
import { Assumption } from '../types/problem';
import { ASTUtils } from './utils';

export class SymbolicSimplifier {
  private readonly MAX_REWRITE_CYCLES = 50;

  public simplify(node: CanonicalAST, assumptions: Assumption[] = []): CanonicalAST {
    let current = ASTUtils.clone(node);
    let previousStr = JSON.stringify(current);
    
    for (let i = 0; i < this.MAX_REWRITE_CYCLES; i++) {
      current = this.simplifyPass(current, assumptions);
      const currentStr = JSON.stringify(current);
      if (currentStr === previousStr) return current; 
      previousStr = currentStr;
    }
    
    console.warn('Simplifier reached max rewrite cycles. Returning best effort.');
    return current;
  }

  private simplifyPass(node: CanonicalAST, assumptions: Assumption[]): CanonicalAST {
    if (node.type === 'Number' || node.type === 'Symbol' || node.type === 'Constant') return node;

    if (node.type === 'Parenthesis') {
      const inner = this.simplifyPass(node.content, assumptions);
      if (['Number', 'Symbol', 'Constant'].includes(inner.type)) return inner;
      return { type: 'Parenthesis', content: inner };
    }

    if (node.type === 'Operator') {
      let args = node.args.map(arg => this.simplifyPass(arg, assumptions));
      return this.simplifyOperator(node.operator, args, assumptions);
    }

    if (node.type === 'Function') {
      let args = node.args.map(arg => this.simplifyPass(arg, assumptions));
      return this.simplifyFunction(node.name, args, assumptions);
    }

    if (node.type === 'Equation' || node.type === 'Inequality') {
      return {
        ...node,
        lhs: this.simplifyPass((node as any).lhs, assumptions),
        rhs: this.simplifyPass((node as any).rhs, assumptions)
      } as CanonicalAST;
    }

    return node;
  }

  private simplifyOperator(op: string, args: CanonicalAST[], assumptions: Assumption[]): CanonicalAST {
    if (args.every(a => a.type === 'Number')) return this.foldConstants(op, args);

    if (op === '+') {
      args = args.filter(a => !this.isNumber(a, 0));
      if (args.length === 0) return { type: 'Number', value: '0' };
      if (args.length === 1) return args[0];
      return this.combineLikeTerms(args);
    }

    if (op === '-') {
      if (this.isNumber(args[1], 0)) return args[0];
      if (ASTUtils.structuralEquals(args[0], args[1])) return { type: 'Number', value: '0' };
    }

    if (op === '*' || op === 'implicit_multiply') {
      args = this.cancelFractions(args);
      args = this.multiplyRadicals(args);

      if (args.some(a => this.isNumber(a, 0))) return { type: 'Number', value: '0' };
      args = args.filter(a => !this.isNumber(a, 1));
      if (args.length === 0) return { type: 'Number', value: '1' };
      if (args.length === 1) return args[0];
      args.sort((a, b) => (a.type === 'Number' ? -1 : (b.type === 'Number' ? 1 : 0)));
    }

    if (op === '/') {
      if (this.isNumber(args[0], 0)) return { type: 'Number', value: '0' };
      if (this.isNumber(args[1], 1)) return args[0];
      if (ASTUtils.structuralEquals(args[0], args[1])) return { type: 'Number', value: '1' };
      
      const cancelled = this.cancelDivisionFactors(args[0], args[1]);
      if (cancelled) return this.simplifyOperator('/', [cancelled.num, cancelled.den], assumptions);
    }

    if (op === '^') {
      if (this.isNumber(args[1], 0)) return { type: 'Number', value: '1' };
      if (this.isNumber(args[1], 1)) return args[0];
      if (this.isNumber(args[0], 0)) return { type: 'Number', value: '0' };
      if (this.isNumber(args[0], 1)) return { type: 'Number', value: '1' };
      if (args[0].type === 'Function' && args[0].name === 'sqrt' && this.isNumber(args[1], 2)) return args[0].args[0];

      // Distribute exponent over multiplication: (A * B)^C -> A^C * B^C
      if (args[0].type === 'Operator' && (args[0].operator === '*' || args[0].operator === 'implicit_multiply')) {
        const distributedArgs = args[0].args.map(a => this.simplifyOperator('^', [a, args[1]], assumptions));
        return this.simplifyOperator('*', distributedArgs, assumptions);
      }
    }

    return { type: 'Operator', operator: op as any, args };
  }

  private cancelDivisionFactors(num: CanonicalAST, den: CanonicalAST): { num: CanonicalAST, den: CanonicalAST } | null {
    const getFactors = (node: CanonicalAST): CanonicalAST[] => {
      if (node.type === 'Operator' && (node.operator === '*' || node.operator === 'implicit_multiply')) return node.args;
      return [node];
    };

    const numFactors = getFactors(num);
    const denFactors = getFactors(den);
    let changed = false;

    for (let i = 0; i < numFactors.length; i++) {
      for (let j = 0; j < denFactors.length; j++) {
        if (ASTUtils.structuralEquals(numFactors[i], denFactors[j])) {
          numFactors.splice(i, 1);
          denFactors.splice(j, 1);
          changed = true;
          i--;
          break;
        }
      }
    }

    if (changed) {
      const newNum = numFactors.length === 0 ? { type: 'Number', value: '1' } as CanonicalAST 
                   : numFactors.length === 1 ? numFactors[0] 
                   : { type: 'Operator', operator: '*', args: numFactors } as CanonicalAST;
      const newDen = denFactors.length === 0 ? { type: 'Number', value: '1' } as CanonicalAST 
                   : denFactors.length === 1 ? denFactors[0] 
                   : { type: 'Operator', operator: '*', args: denFactors } as CanonicalAST;
      return { num: newNum, den: newDen };
    }
    return null;
  }

  // ... (multiplyRadicals, cancelFractions, foldConstants, combineLikeTerms, simplifyFunction, isNumber, hasAssumption omitted for brevity but remain the same)
  private multiplyRadicals(args: CanonicalAST[]): CanonicalAST[] {
    let newArgs = [...args];
    for (let i = 0; i < newArgs.length; i++) {
      if (newArgs[i].type === 'Function' && (newArgs[i] as any).name === 'sqrt') {
        const matchIdx = newArgs.findIndex((a, idx) => idx > i && ASTUtils.structuralEquals(a, newArgs[i]));
        if (matchIdx !== -1) {
          newArgs[i] = (newArgs[i] as any).args[0]; 
          newArgs.splice(matchIdx, 1);
          i--; 
        }
      }
    }
    return newArgs;
  }

  private cancelFractions(args: CanonicalAST[]): CanonicalAST[] {
    let newArgs = [...args];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < newArgs.length; i++) {
        const arg = newArgs[i];
        if (arg.type === 'Operator' && arg.operator === '/') {
          const num = arg.args[0];
          const den = arg.args[1];
          const denIdx = newArgs.findIndex((a, idx) => idx !== i && ASTUtils.structuralEquals(a, den));
          if (denIdx !== -1) {
            newArgs[i] = num;
            newArgs.splice(denIdx, 1);
            changed = true;
            break;
          }
        }
      }
    }
    return newArgs;
  }

  private foldConstants(op: string, args: CanonicalAST[]): CanonicalAST {
    const vals = args.map(a => parseFloat((a as any).value));
    let res = 0;
    switch (op) {
      case '+': res = vals[0] + vals[1]; break;
      case '-': res = vals[0] - vals[1]; break;
      case '*': case 'implicit_multiply': res = vals[0] * vals[1]; break;
      case '/': res = vals[0] / vals[1]; break;
      case '^': res = Math.pow(vals[0], vals[1]); break;
    }
    return { type: 'Number', value: res.toString() };
  }

  private combineLikeTerms(args: CanonicalAST[]): CanonicalAST {
    if (args.length === 2 && ASTUtils.structuralEquals(args[0], args[1])) {
      return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '2' }, args[0]] };
    }
    return { type: 'Operator', operator: '+', args };
  }

  private simplifyFunction(name: string, args: CanonicalAST[], assumptions: Assumption[]): CanonicalAST {
    const inner = args[0];
    if (name === 'sqrt' && inner.type === 'Operator' && inner.operator === '^') {
      const powArgs = inner.args;
      if (this.isNumber(powArgs[1], 2)) {
        const base = powArgs[0];
        if (this.hasAssumption(base, '>=', 0, assumptions) || this.hasAssumption(base, '>', 0, assumptions)) return base;
        if (this.hasAssumption(base, '<=', 0, assumptions) || this.hasAssumption(base, '<', 0, assumptions)) return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, base] };
        return { type: 'Function', name: 'abs', args: [base] };
      }
    }
    if (name === 'exp' && this.isNumber(inner, 0)) return { type: 'Number', value: '1' };
    if ((name === 'log' || name === 'ln') && this.isNumber(inner, 1)) return { type: 'Number', value: '0' };
    if ((name === 'log' || name === 'ln') && inner.type === 'Function' && inner.name === 'exp') return inner.args[0];
    if (name === 'sin' && this.isNumber(inner, 0)) return { type: 'Number', value: '0' };
    if (name === 'cos' && this.isNumber(inner, 0)) return { type: 'Number', value: '1' };
    if (name === 'cos' && inner.type === 'Symbol' && inner.name === 'pi') return { type: 'Number', value: '-1' };
    if (name === 'sin' && inner.type === 'Symbol' && inner.name === 'pi') return { type: 'Number', value: '0' };
    if (name === 'tan' && this.isNumber(inner, 0)) return { type: 'Number', value: '0' };
    
    return { type: 'Function', name, args };
  }

  private isNumber(node: CanonicalAST, val: number): boolean {
    return node.type === 'Number' && parseFloat((node as any).value) === val;
  }

  private hasAssumption(node: CanonicalAST, relation: string, value: any, assumptions: Assumption[]): boolean {
    if (node.type !== 'Symbol') return false; 
    const symName = (node as any).name;
    return assumptions.some(a => a.variable === symName && a.relation === relation && a.value === value);
  }
}
