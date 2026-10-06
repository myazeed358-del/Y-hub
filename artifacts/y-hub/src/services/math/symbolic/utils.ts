import { CanonicalAST } from '../types/ast';

export class ASTUtils {
  public static structuralKey(node: CanonicalAST): string {
    return JSON.stringify(node);
  }

  public static serialize(node: CanonicalAST): string {
    switch (node.type) {
      case 'Number':
        return node.value;
      case 'Symbol':
      case 'Constant':
        return node.name;
      case 'Operator': {
        const args = node.args.map(arg => ASTUtils.serialize(arg));
        if (node.operator === '!') return `(${args[0]}!)`;
        if (node.operator === '%' && args.length === 1) return `(${args[0]}%)`;
        const operator = node.operator === 'implicit_multiply' ? '*' : node.operator;
        return `(${args.join(` ${operator} `)})`;
      }
      case 'Function':
        return `${node.name}(${node.args.map(arg => ASTUtils.serialize(arg)).join(', ')})`;
      case 'Parenthesis':
        return `(${ASTUtils.serialize(node.content)})`;
      case 'Equation':
        return `${ASTUtils.serialize(node.lhs)} = ${ASTUtils.serialize(node.rhs)}`;
      case 'Inequality':
        return `${ASTUtils.serialize(node.lhs)} ${node.operator} ${ASTUtils.serialize(node.rhs)}`;
      case 'Matrix':
        return `[${node.rows.map(row => `[${row.map(entry => ASTUtils.serialize(entry)).join(', ')}]`).join(', ')}]`;
      case 'Vector':
        return `[${node.elements.map(entry => ASTUtils.serialize(entry)).join(', ')}]`;
    }
  }

  public static containsVariable(node: CanonicalAST, variable: string): boolean {
    switch (node.type) {
      case 'Symbol':
        return node.name === variable;
      case 'Operator':
      case 'Function':
        return node.args.some(arg => ASTUtils.containsVariable(arg, variable));
      case 'Parenthesis':
        return ASTUtils.containsVariable(node.content, variable);
      case 'Equation':
      case 'Inequality':
        return ASTUtils.containsVariable(node.lhs, variable) || ASTUtils.containsVariable(node.rhs, variable);
      case 'Matrix':
        return node.rows.some(row => row.some(entry => ASTUtils.containsVariable(entry, variable)));
      case 'Vector':
        return node.elements.some(entry => ASTUtils.containsVariable(entry, variable));
      case 'Number':
      case 'Constant':
        return false;
    }
  }

  public static clone(node: CanonicalAST): CanonicalAST {
    return JSON.parse(JSON.stringify(node));
  }

  public static structuralEquals(node1: CanonicalAST, node2: CanonicalAST): boolean {
    // Highly simplified structural equality check, ignoring communativity
    return JSON.stringify(node1) === JSON.stringify(node2);
  }

  // Backward-compatible alias used by older symbolic/ODE services.
  public static isEqual(node1: CanonicalAST, node2: CanonicalAST): boolean {
    return ASTUtils.structuralEquals(node1, node2);
  }

  public static isInfinity(node: CanonicalAST): boolean {
    if (node.type === 'Symbol' || node.type === 'Constant') {
      const name = node.name.toLowerCase();
      return name === 'infinity' || name === 'inf' || name === '∞';
    }

    if (
      node.type === 'Operator' &&
      node.operator === '-' &&
      node.args.length === 2 &&
      node.args[0].type === 'Number' &&
      node.args[0].value === '0'
    ) {
      return ASTUtils.isInfinity(node.args[1]);
    }

    return false;
  }

  public static extractSymbols(node: CanonicalAST, symbols = new Set<string>()): Set<string> {
    if (node.type === 'Symbol') {
      symbols.add(node.name);
    } else if (node.type === 'Operator') {
      node.args.forEach(arg => ASTUtils.extractSymbols(arg, symbols));
    } else if (node.type === 'Function') {
      node.args.forEach(arg => ASTUtils.extractSymbols(arg, symbols));
    } else if (node.type === 'Parenthesis') {
      ASTUtils.extractSymbols(node.content, symbols);
    } else if (node.type === 'Equation' || node.type === 'Inequality') {
      ASTUtils.extractSymbols((node as any).lhs, symbols);
      ASTUtils.extractSymbols((node as any).rhs, symbols);
    }
    return symbols;
  }

  public static substitute(node: CanonicalAST, variable: string, replacement: CanonicalAST): CanonicalAST {
    if (node.type === 'Symbol' && node.name === variable) {
      return ASTUtils.clone(replacement);
    }

    if (node.type === 'Operator') {
      return { ...node, args: node.args.map(arg => ASTUtils.substitute(arg, variable, replacement)) } as CanonicalAST;
    }

    if (node.type === 'Function') {
      return { ...node, args: node.args.map(arg => ASTUtils.substitute(arg, variable, replacement)) } as CanonicalAST;
    }

    if (node.type === 'Parenthesis') {
      return { ...node, content: ASTUtils.substitute(node.content, variable, replacement) } as CanonicalAST;
    }

    if (node.type === 'Equation' || node.type === 'Inequality') {
      return {
        ...node,
        lhs: ASTUtils.substitute((node as any).lhs, variable, replacement),
        rhs: ASTUtils.substitute((node as any).rhs, variable, replacement)
      } as CanonicalAST;
    }

    return ASTUtils.clone(node);
  }

  public static findNode(node: CanonicalAST, predicate: (n: CanonicalAST) => boolean): CanonicalAST | null {
    if (predicate(node)) return node;
    
    if (node.type === 'Operator' || node.type === 'Function') {
      for (const arg of (node as any).args) {
        const found = ASTUtils.findNode(arg, predicate);
        if (found) return found;
      }
    } else if (node.type === 'Parenthesis') {
      return ASTUtils.findNode((node as any).content, predicate);
    } else if (node.type === 'Equation' || node.type === 'Inequality') {
      let found = ASTUtils.findNode((node as any).lhs, predicate);
      if (found) return found;
      return ASTUtils.findNode((node as any).rhs, predicate);
    }
    return null;
  }

  public static replaceNode(root: CanonicalAST, targetNode: CanonicalAST, replacement: CanonicalAST): CanonicalAST {
    if (ASTUtils.structuralEquals(root, targetNode)) {
      return ASTUtils.clone(replacement);
    }

    if (root.type === 'Operator' || root.type === 'Function') {
      return {
        ...root,
        args: (root as any).args.map((arg: CanonicalAST) => ASTUtils.replaceNode(arg, targetNode, replacement))
      } as CanonicalAST;
    } else if (root.type === 'Parenthesis') {
      return {
        ...root,
        content: ASTUtils.replaceNode((root as any).content, targetNode, replacement)
      } as CanonicalAST;
    } else if (root.type === 'Equation' || root.type === 'Inequality') {
      return {
        ...root,
        lhs: ASTUtils.replaceNode((root as any).lhs, targetNode, replacement),
        rhs: ASTUtils.replaceNode((root as any).rhs, targetNode, replacement)
      } as CanonicalAST;
    }
    
    return ASTUtils.clone(root);
  }
}
