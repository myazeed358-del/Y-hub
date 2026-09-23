import { CanonicalAST } from '../types/ast';

export class ASTUtils {
  public static clone(node: CanonicalAST): CanonicalAST {
    return JSON.parse(JSON.stringify(node));
  }

  public static structuralEquals(node1: CanonicalAST, node2: CanonicalAST): boolean {
    // Highly simplified structural equality check, ignoring communativity
    return JSON.stringify(node1) === JSON.stringify(node2);
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
