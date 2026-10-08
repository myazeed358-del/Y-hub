import * as math from 'mathjs';
import { ExpressionParser } from '../services/math/parser';
import { ASTNormalizer } from '../services/math/parser/normalizer';
import { LimitEngine } from '../services/math/symbolic/limit';
import type { CanonicalAST } from '../services/math/types/ast';
import type { LimitDirection, LimitApproach } from '../services/math/types/limit';
import type { LimitClassification } from '../services/math/types/result';

export interface CalculusLimitOutcome {
  classification: LimitClassification;
  valueLatex: string | null;
  strategy: string;
  warnings: string[];
  conditions: string[];
}

function parseApproach(input: string): LimitApproach {
  const value = input.trim().toLowerCase();

  if (['inf', '+inf', 'infinity', '+infinity', '∞', '+∞'].includes(value)) {
    return '+infinity';
  }

  if (['-inf', '-infinity', '-∞'].includes(value)) {
    return '-infinity';
  }

  if (!value || value.length > 48 || !/^[0-9a-z+\-*/().\s]+$/.test(value)) {
    throw new Error('Invalid limit approach');
  }

  const names = value.match(/[a-z]+/g) ?? [];
  if (names.some((name) => name !== 'pi' && name !== 'e')) {
    throw new Error('Unsupported limit approach');
  }

  const evaluated: unknown = math.evaluate(value);

  if (typeof evaluated !== 'number' || !Number.isFinite(evaluated)) {
    throw new Error('Limit approach must be a finite real number');
  }

  return evaluated;
}

function astToExpression(node: CanonicalAST): string {
  switch (node.type) {
    case 'Number':
      return node.value;

    case 'Symbol':
      return node.name;

    case 'Constant':
      return node.name;

    case 'Parenthesis':
      return `(${astToExpression(node.content)})`;

    case 'Function':
      return `${node.name}(${node.args.map(astToExpression).join(',')})`;

    case 'Operator': {
      const args = node.args.map(astToExpression);

      if (node.operator === '!') {
        if (args.length !== 1) throw new Error('Invalid factorial');
        return `(${args[0]})!`;
      }

      if (node.operator === '-' && args.length === 1) {
        return `(-(${args[0]}))`;
      }

      const operator = node.operator === 'implicit_multiply'
        ? '*'
        : node.operator;

      if (args.length < 2) {
        throw new Error('Invalid mathematical operator');
      }

      return `(${args.map((arg) => `(${arg})`).join(operator)})`;
    }

    default:
      throw new Error(`Unsupported AST node for limit result: ${node.type}`);
  }
}

function astToLatex(node: CanonicalAST): string {
  const expression = astToExpression(node);
  return math.parse(expression).toTex();
}

export function evaluateCalculusLimit(
  expression: string,
  approachInput: string,
  direction: LimitDirection
): CalculusLimitOutcome {
  if (!expression.trim()) {
    throw new Error('Expression is required');
  }

  const approach = parseApproach(approachInput);

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const result = engine.evaluateLimit({
    expression: normalizer.normalize(parser.parse(expression)),
    variable: 'x',
    approach,
    direction,
    options: { domain: 'real', mode: 'AUTO' },
  });

  let classification = result.classification;
  let valueLatex: string | null = null;
  const warnings = [...result.warnings];

  if (classification === 'finite') {
    if (!result.value) {
      classification = 'not_proven';
      warnings.push('finite_result_missing_value');
    } else {
      try {
        valueLatex = astToLatex(result.value);
      } catch {
        classification = 'not_proven';
        warnings.push('result_formatting_failed');
      }
    }
  }

  if (classification === '+infinity') {
    valueLatex = '+\\infty';
  }

  if (classification === '-infinity') {
    valueLatex = '-\\infty';
  }

  return {
    classification,
    valueLatex,
    strategy: result.strategy,
    warnings,
    conditions: result.conditions,
  };
}
