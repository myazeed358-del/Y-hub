import { MathProblemRequest, MathOperation, MathOptions, Assumption } from '../types/problem';
import { CanonicalAST } from '../types/ast';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

export class ProblemClassifier {
  private parser = new ExpressionParser();
  private normalizer = new ASTNormalizer();

  public classify(rawInput: string, explicitOptions?: Partial<MathOptions>, assumptions: Assumption[] = []): MathProblemRequest {
    let operation: MathOperation = 'evaluate';
    let mathString = rawInput.trim();
    let variable: string | undefined = undefined;

    // Very basic heuristic request parser 
    // e.g., "solve x^2 + 2x = 0" -> operation: 'solve_equation', mathString: 'x^2 + 2x = 0'
    const lowerInput = mathString.toLowerCase();
    
    if (lowerInput.startsWith('solve ')) {
      mathString = mathString.substring(6).trim();
      operation = mathString.includes('<') || mathString.includes('>') ? 'solve_inequality' : 'solve_equation';
    } else if (lowerInput.startsWith('differentiate ') || lowerInput.startsWith('derive ')) {
      mathString = mathString.replace(/^(differentiate|derive)\s+/i, '').trim();
      operation = 'derive';
    } else if (lowerInput.startsWith('integrate ')) {
      mathString = mathString.replace(/^integrate\s+/i, '').trim();
      operation = 'integrate';
    } else if (lowerInput.startsWith('limit ')) {
      mathString = mathString.replace(/^limit\s+/i, '').trim();
      operation = 'limit';
    }

    // Parse the extracted math expression
    let ast: CanonicalAST | undefined = undefined;
    try {
      const rawAst = this.parser.parse(mathString);
      ast = this.normalizer.normalize(rawAst);
      
      // Auto-detect equation vs evaluate if not explicitly stated
      if (ast.type === 'Equation' && operation === 'evaluate') {
        operation = 'solve_equation';
      }
    } catch (e) {
      // If parsing fails, AST is undefined, handled by downstream layers
      console.warn("Classification parser failed on string:", mathString);
    }

    return {
      rawInput,
      operation,
      expression: ast,
      variable,
      assumptions,
      options: {
        mode: explicitOptions?.mode || 'AUTO',
        domain: explicitOptions?.domain || 'real',
        tolerance: explicitOptions?.tolerance || 1e-7
      }
    };
  }
}
