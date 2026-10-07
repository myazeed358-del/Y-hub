import { CanonicalAST } from '../types/ast';

export class ASTEvaluator {
  public evaluate(node: CanonicalAST, points: Record<string, number>): number {
    if (node.type === 'Number') return parseFloat((node as any).value);
    if (node.type === 'Symbol') {
      const name = (node as any).name;
      if (points[name] !== undefined) return points[name];
      throw new Error(`Missing evaluation point for variable ${name}`);
    }
    if (node.type === 'Constant') {
      const name = (node as any).name;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      throw new Error(`Unknown constant ${name}`);
    }
    if (node.type === 'Operator') {
      const op = node as any;
      const args = op.args.map((a: CanonicalAST) => this.evaluate(a, points));
      switch(op.operator) {
        case '+': return args.reduce((sum: number, v: number) => sum + v, 0);
        case '-': return args.length === 1 ? -args[0] : args[0] - args.slice(1).reduce((s: number, v: number) => s + v, 0);
        case '*': case 'implicit_multiply': return args.reduce((prod: number, v: number) => prod * v, 1);
        case '/': return args[0] / args[1];
        case '^': return Math.pow(args[0], args[1]);
        default: throw new Error(`Unsupported operator ${op.operator}`);
      }
    }
    if (node.type === 'Function') {
      const fn = node as any;
      const val = this.evaluate(fn.args[0], points);
      switch(fn.name) {
        case 'sin': return Math.sin(val);
        case 'cos': return Math.cos(val);
        case 'tan': return Math.tan(val);
        case 'sec': return 1 / Math.cos(val);
        case 'csc': return 1 / Math.sin(val);
        case 'cot': return 1 / Math.tan(val);
        case 'asin': return Math.asin(val);
        case 'acos': return Math.acos(val);
        case 'atan': return Math.atan(val);
        case 'sinh': return Math.sinh(val);
        case 'cosh': return Math.cosh(val);
        case 'tanh': return Math.tanh(val);
        case 'sech': return 1 / Math.cosh(val);
        case 'exp': return Math.exp(val);
        case 'log': case 'ln': return Math.log(val);
        case 'sqrt': return Math.sqrt(val);
        case 'abs': return Math.abs(val);
        default: throw new Error(`Unsupported function ${fn.name}`);
      }
    }
    if (node.type === 'Parenthesis') {
      return this.evaluate((node as any).content, points);
    }
    throw new Error(`Cannot evaluate node type ${node.type}`);
  }
}
