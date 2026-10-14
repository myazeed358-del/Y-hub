import type { CanonicalAST, InequalityNode } from '../types/ast';
import type { Endpoint, Interval } from '../types/set';
import { Rat } from '../utils/rational';

/** Stateless conversions used by inequality strategies; never performs equation solving. */
export class InequalityAstToolkit {
public fractionalize(node: CanonicalAST): { num: CanonicalAST, den: CanonicalAST } {
    if (node.type === 'Number' || node.type === 'Symbol' || node.type === 'Constant') {
        return { num: node, den: { type: 'Number', value: '1' } };
    }
    if (node.type === 'Parenthesis') return this.fractionalize(node.content);
    if (node.type === 'Operator') {
        if (node.operator === '/') {
            const n = this.fractionalize(node.args[0]);
            const d = this.fractionalize(node.args[1]);
            return {
                num: { type: 'Operator', operator: '*', args: [n.num, d.den] },
                den: { type: 'Operator', operator: '*', args: [n.den, d.num] }
            };
        }
        if (node.operator === '*') {
            let nAST: CanonicalAST[] = [];
            let dAST: CanonicalAST[] = [];
            for (const arg of node.args) {
                const f = this.fractionalize(arg);
                nAST.push(f.num);
                dAST.push(f.den);
            }
            return {
                num: nAST.length === 1 ? nAST[0] : { type: 'Operator', operator: '*', args: nAST },
                den: dAST.length === 1 ? dAST[0] : { type: 'Operator', operator: '*', args: dAST }
            };
        }
        if (node.operator === '+') {
            let curN = this.fractionalize(node.args[0]).num;
            let curD = this.fractionalize(node.args[0]).den;
            for (let i = 1; i < node.args.length; i++) {
                const next = this.fractionalize(node.args[i]);
                curN = {
                    type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [curN, next.den] },
                        { type: 'Operator', operator: '*', args: [next.num, curD] }
                    ]
                };
                curD = { type: 'Operator', operator: '*', args: [curD, next.den] };
            }
            return { num: curN, den: curD };
        }
        if (node.operator === '-') {
            let curN = this.fractionalize(node.args[0]).num;
            let curD = this.fractionalize(node.args[0]).den;
            for (let i = 1; i < node.args.length; i++) {
                const next = this.fractionalize(node.args[i]);
                curN = {
                    type: 'Operator', operator: '-', args: [
                        { type: 'Operator', operator: '*', args: [curN, next.den] },
                        { type: 'Operator', operator: '*', args: [next.num, curD] }
                    ]
                };
                curD = { type: 'Operator', operator: '*', args: [curD, next.den] };
            }
            return { num: curN, den: curD };
        }
        if (node.operator === '^') {
            const base = this.fractionalize(node.args[0]);
            return {
                num: { type: 'Operator', operator: '^', args: [base.num, node.args[1]] },
                den: { type: 'Operator', operator: '^', args: [base.den, node.args[1]] }
            };
        }
    }
    return { num: node, den: { type: 'Number', value: '1' } };
  }

public makeEndpoint(val: number): Endpoint {
    try {
      const rat = Rat.fromNumber(val);
      const isInt = rat.den === 1n;
      const ast: CanonicalAST = isInt ?
        { type: 'Number', value: rat.num.toString() } :
        { type: 'Operator', operator: '/', args: [{ type: 'Number', value: rat.num.toString() }, { type: 'Number', value: rat.den.toString() }] };
      return { type: 'value', ast, rational: rat };
    } catch {
      return { type: 'value', ast: { type: 'Number', value: val.toString() } };
    }
  }

public findAbsNodes(ast: CanonicalAST): CanonicalAST[] {
    const nodes: CanonicalAST[] = [];
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Function' && node.name === 'abs') {
        nodes.push(node);
      }
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
      if (node.type === 'Inequality') { traverse(node.lhs); traverse(node.rhs); }
    };
    traverse(ast);
    return nodes;
  }

public hasNestedAbs(absNode: CanonicalAST): boolean {
    let nested = false;
    const traverse = (node: CanonicalAST) => {
      if (node !== absNode && node.type === 'Function' && node.name === 'abs') nested = true;
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
    };
    traverse(absNode);
    return nested;
  }

public replaceAbsWithSymbol(ast: CanonicalAST, targetInnerStr: string): CanonicalAST {
    if (ast.type === 'Function' && ast.name === 'abs' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___ABS___' };
    }
    if (ast.type === 'Operator') return { ...ast, args: ast.args.map(a => this.replaceAbsWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Function') return { ...ast, args: ast.args.map(a => this.replaceAbsWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Parenthesis') return { ...ast, content: this.replaceAbsWithSymbol(ast.content, targetInnerStr) };
    if (ast.type === 'Inequality') return { ...ast, lhs: this.replaceAbsWithSymbol(ast.lhs, targetInnerStr) as any, rhs: this.replaceAbsWithSymbol(ast.rhs, targetInnerStr) as any };
    return ast;
  }

public containsVariable(ast: CanonicalAST, variable: string): boolean {
    let has = false;
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Symbol' && node.name === variable) has = true;
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
    };
    traverse(ast);
    return has;
  }

public evaluateConstant(ast: CanonicalAST): number | null {
    if (ast.type === 'Number') return parseFloat(ast.value);
    if (ast.type === 'Operator' && ast.operator === '*' && ast.args[0].type === 'Number' && ast.args[0].value === '-1' && ast.args[1].type === 'Number') {
      return -parseFloat((ast.args[1] as any).value);
    }
    if (ast.type === 'Operator') {
      const args = ast.args.map(a => this.evaluateConstant(a));
      if (args.some(a => a === null)) return null;
      if (ast.operator === '+') return (args as number[]).reduce((a,b) => a+b, 0);
      if (ast.operator === '-') return args.length === 1 ? -args[0]! : args[0]! - args[1]!;
      if (ast.operator === '*') return (args as number[]).reduce((a,b) => a*b, 1);
      if (ast.operator === '/') return args[0]! / args[1]!;
      if (ast.operator === '^') return Math.pow(args[0]!, args[1]!);
    }
    if (ast.type === 'Parenthesis') return this.evaluateConstant(ast.content);
    return null;
  }

public findRadicalNodes(ast: CanonicalAST): CanonicalAST[] {
    const nodes: CanonicalAST[] = [];
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Function' && node.name === 'sqrt') {
        nodes.push(node);
      }
      if (node.type === 'Operator' && node.operator === '^' && node.args[1].type === 'Number' && node.args[1].value === '0.5') {
        nodes.push(node);
      }
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
      if (node.type === 'Inequality') { traverse(node.lhs); traverse(node.rhs); }
    };
    traverse(ast);
    return nodes;
  }

public replaceRadicalWithSymbol(ast: CanonicalAST, targetInnerStr: string): CanonicalAST {
    if (ast.type === 'Function' && ast.name === 'sqrt' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___RAD___' };
    }
    if (ast.type === 'Operator' && ast.operator === '^' && ast.args[1].type === 'Number' && ast.args[1].value === '0.5' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___RAD___' };
    }
    if (ast.type === 'Operator') return { ...ast, args: ast.args.map(a => this.replaceRadicalWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Function') return { ...ast, args: ast.args.map(a => this.replaceRadicalWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Parenthesis') return { ...ast, content: this.replaceRadicalWithSymbol(ast.content, targetInnerStr) };
    if (ast.type === 'Inequality') return { ...ast, lhs: this.replaceRadicalWithSymbol(ast.lhs, targetInnerStr) as any, rhs: this.replaceRadicalWithSymbol(ast.rhs, targetInnerStr) as any };
    return ast;
  }

public reverseRelation(rel: InequalityNode['operator']): InequalityNode['operator'] {
    switch (rel) {
      case '<': return '>';
      case '<=': return '>=';
      case '>': return '<';
      case '>=': return '<=';
      default: return rel;
    }
  }

public evaluateConstantInequality(bNode: CanonicalAST, rel: string): Interval[] {
    // We only evaluate simple constants for now.
    let val = 0;
    if (bNode.type === 'Number') {
      val = parseFloat(bNode.value);
    } else if (bNode.type === 'Operator' && bNode.operator === '*' && bNode.args[0].type === 'Number' && bNode.args[0].value === '-1' && bNode.args[1].type === 'Number') {
      val = -parseFloat((bNode.args[1] as any).value);
    } else if (bNode.type === 'Operator' && bNode.operator === '/' && bNode.args[0].type === 'Number' && bNode.args[1].type === 'Number') {
      val = parseFloat((bNode.args[0] as any).value) / parseFloat((bNode.args[1] as any).value);
    }

    let isTrue = false;
    switch (rel) {
      case '<': isTrue = val < 0; break;
      case '<=': isTrue = val <= 0; break;
      case '>': isTrue = val > 0; break;
      case '>=': isTrue = val >= 0; break;
      case '!=': isTrue = val !== 0; break;
    }

    if (isTrue) {
      return [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
    } else {
      return [];
    }
  }

public buildInterval(rel: string, endpoint: Endpoint): Interval[] {
    switch (rel) {
      case '<': return [{ left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: false }];
      case '<=': return [{ left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: true }];
      case '>': return [{ left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      case '>=': return [{ left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: true, rightClosed: false }];
      case '!=': return [
        { left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: false },
        { left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }
      ];
      default: return [];
    }
  }
}
