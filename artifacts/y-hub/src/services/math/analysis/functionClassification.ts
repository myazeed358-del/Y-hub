import type { CanonicalAST } from '../types/ast';
import type { FunctionClassification } from '../types/analysis';

/** Classification rules independent of analysis orchestration. */
export function classifyFunction(ast: CanonicalAST): FunctionClassification[] {
    const classes = new Set<FunctionClassification>();
    const walk = (node: CanonicalAST) => {
      if (node.type === 'Operator' && node.operator === '/') {
        classes.add('rational'); // might be refined
      }
      if (node.type === 'Function') {
        const name = node.name.toLowerCase();
        if (name === 'sqrt' || name === 'cbrt') classes.add('radical');
        else if (name === 'abs') classes.add('absolute_value');
        else if (name === 'ln' || name === 'log' || name === 'log10') classes.add('logarithmic');
        else if (name === 'exp') classes.add('exponential');
        else if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(name)) classes.add('trigonometric');
      }
      if (node.type === 'Operator' || node.type === 'Function') {
        node.args?.forEach(walk);
      }
      if (node.type === 'Parenthesis') {
        walk(node.content);
      }
    };
    walk(ast);

    if (classes.size === 0) classes.add('polynomial'); // fallback descriptive
    return Array.from(classes);
  }
