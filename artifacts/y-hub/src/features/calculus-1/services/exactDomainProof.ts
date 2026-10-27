import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { ASTUtils } from '@/services/math/symbolic/utils';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import { SetEngine } from '@/services/math/symbolic/sets';
import {
  extractQuadraticDomainPolynomial,
  solveQuadraticDomainConstraint,
  type QuadraticDomainPolynomial
} from './quadraticDomainConstraints';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { Endpoint, Interval } from '@/services/math/types/set';
import type { MathStep } from '@/services/math/types/step';

type Affine = { a: Rational; b: Rational };
type Condition = {
  expression: string;
  kind: 'nonzero' | 'positive' | 'nonnegative';
  coefficients: Affine | QuadraticDomainPolynomial;
};

export type ExactDomainProof =
  | {
      status: 'verified';
      scope: 'supported_real_functions_polynomial_constraints';
      intervals: Interval[];
      domain: string[];
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

function fromDecimal(value: string): Rational | null {
  if (!/^-?\d{1,7}(?:\.\d{1,6})?$/.test(value)) {
    return null;
  }

  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ''] = unsigned.split('.');

  return Rat.simplify({
    num: (negative ? -1n : 1n) *
      BigInt(integer + fraction),
    den: 10n ** BigInt(fraction.length)
  });
}

function show(value: Rational): string {
  const r = Rat.simplify(value);
  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function negate(value: Rational): Rational {
  return Rat.mul(value, { num: -1n, den: 1n });
}

function affine(node: CanonicalAST): Affine | null {
  if (node.type === 'Parenthesis') {
    return affine(node.content);
  }

  if (node.type === 'Number') {
    const n = fromDecimal(node.value);
    return n ? { a: Rat.zero, b: n } : null;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x'
      ? { a: Rat.one, b: Rat.zero }
      : null;
  }

  if (node.type !== 'Operator') return null;

  const args = node.args;

  if (node.operator === '+') {
    if (!args.length) return null;
    let result: Affine = { a: Rat.zero, b: Rat.zero };

    for (const arg of args) {
      const value = affine(arg);
      if (!value) return null;
      result = {
        a: Rat.add(result.a, value.a),
        b: Rat.add(result.b, value.b)
      };
    }

    return result;
  }

  if (node.operator === '-') {
    if (args.length !== 1 && args.length !== 2) {
      return null;
    }

    const first = affine(args[0]);
    if (!first) return null;

    if (args.length === 1) {
      return { a: negate(first.a), b: negate(first.b) };
    }

    const second = affine(args[1]);
    if (!second) return null;

    return {
      a: Rat.sub(first.a, second.a),
      b: Rat.sub(first.b, second.b)
    };
  }

  if (
    node.operator === '*' ||
    node.operator === 'implicit_multiply'
  ) {
    if (!args.length) return null;

    let result: Affine = { a: Rat.zero, b: Rat.one };

    for (const arg of args) {
      const value = affine(arg);
      if (!value) return null;

      if (
        !Rat.isZero(result.a) &&
        !Rat.isZero(value.a)
      ) {
        return null;
      }

      result = {
        a: Rat.add(
          Rat.mul(result.a, value.b),
          Rat.mul(result.b, value.a)
        ),
        b: Rat.mul(result.b, value.b)
      };
    }

    return result;
  }

  if (node.operator === '/') {
    if (args.length !== 2) return null;

    const numerator = affine(args[0]);
    const denominator = affine(args[1]);

    if (
      !numerator ||
      !denominator ||
      !Rat.isZero(denominator.a) ||
      Rat.isZero(denominator.b)
    ) {
      return null;
    }

    return {
      a: Rat.div(numerator.a, denominator.b),
      b: Rat.div(numerator.b, denominator.b)
    };
  }

  if (node.operator === '^') {
    if (
      args.length !== 2 ||
      args[1].type !== 'Number' ||
      !/^(?:[0-9]|1[0-2])$/.test(args[1].value)
    ) {
      return null;
    }

    const base = affine(args[0]);
    if (!base) return null;

    const exponent = BigInt(args[1].value);

    if (exponent === 0n) {
      return { a: Rat.zero, b: Rat.one };
    }

    if (exponent === 1n) return base;
    if (!Rat.isZero(base.a)) return null;

    return {
      a: Rat.zero,
      b: Rat.pow(base.b, exponent)
    };
  }

  return null;
}

function collect(
  node: CanonicalAST,
  constraints: Condition[]
): boolean {
  if (node.type === 'Parenthesis') {
    return collect(node.content, constraints);
  }

  if (node.type === 'Number') {
    return fromDecimal(node.value) !== null;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x';
  }

  if (node.type === 'Function') {
    if (node.args.length !== 1) return false;

    // These functions do not restrict the real input domain.
    const allowedTotal = [
      'sin', 'cos', 'exp', 'abs', 'atan'
    ];

    if (
      !allowedTotal.includes(node.name) &&
      !['sqrt', 'log', 'ln'].includes(node.name)
    ) {
      return false;
    }

    const argument = node.args[0];

    if (!collect(argument, constraints)) return false;

    if (allowedTotal.includes(node.name)) return true;

    const coefficients = affine(argument) ??
      extractQuadraticDomainPolynomial(argument);
    if (!coefficients) return false;

    constraints.push({
      expression: ASTUtils.serialize(argument),
      kind: node.name === 'sqrt'
        ? 'nonnegative'
        : 'positive',
      coefficients
    });

    return true;
  }

  if (node.type !== 'Operator') return false;

  const args = node.args;

  if (
    ['+', '-', '*', 'implicit_multiply']
      .includes(node.operator)
  ) {
    if (
      !args.length ||
      (node.operator === '-' && args.length > 2)
    ) {
      return false;
    }

    return args.every(arg => collect(arg, constraints));
  }

  if (node.operator === '^') {
    if (
      args.length !== 2 ||
      args[1].type !== 'Number' ||
      !/^(?:[0-9]|1[0-2])$/.test(args[1].value)
    ) {
      return false;
    }

    return collect(args[0], constraints);
  }

  if (node.operator === '/') {
    if (args.length !== 2) return false;

    if (
      !collect(args[0], constraints) ||
      !collect(args[1], constraints)
    ) {
      return false;
    }

    const coefficients = affine(args[1]) ??
      extractQuadraticDomainPolynomial(args[1]);

    if (!coefficients) return false;

    constraints.push({
      expression: ASTUtils.serialize(args[1]),
      kind: 'nonzero',
      coefficients
    });

    return true;
  }

  return false;
}

function endpoint(value: Rational): Endpoint {
  const simplified = Rat.simplify(value);

  return {
    type: 'value',
    ast: { type: 'Number', value: show(simplified) },
    rational: simplified
  };
}

const minusInfinity: Endpoint = {
  type: 'infinity', sign: -1
};

const plusInfinity: Endpoint = {
  type: 'infinity', sign: 1
};

function range(
  left: Endpoint,
  right: Endpoint,
  leftClosed = false,
  rightClosed = false
): Interval {
  return { left, right, leftClosed, rightClosed };
}

function fullLine(): Interval[] {
  return [
    range(minusInfinity, plusInfinity)
  ];
}

function solve(condition: Condition): Interval[] | null {
  const coefficients = condition.coefficients;

  if ('c' in coefficients) {
    return solveQuadraticDomainConstraint(
      coefficients, condition.kind
    );
  }

  const { a, b } = coefficients;

  if (Rat.isZero(a)) {
    const satisfies = condition.kind === 'nonzero'
      ? !Rat.isZero(b)
      : condition.kind === 'positive'
        ? b.num > 0n
        : b.num >= 0n;

    return satisfies ? fullLine() : [];
  }

  const root = endpoint(
    Rat.div(negate(b), a)
  );

  if (condition.kind === 'nonzero') {
    return [
      range(minusInfinity, root),
      range(root, plusInfinity)
    ];
  }

  const inclusive = condition.kind === 'nonnegative';

  return a.num > 0n
    ? [range(root, plusInfinity, inclusive)]
    : [range(minusInfinity, root, false, inclusive)];
}

function boundText(value: Endpoint): string {
  if (value.type === 'infinity') {
    return value.sign === -1
      ? '-infinity'
      : '+infinity';
  }

  return value.rational
    ? show(value.rational)
    : ASTUtils.serialize(value.ast);
}

function format(interval: Interval): string {
  return (
    `${interval.leftClosed ? '[' : '('}` +
    `${boundText(interval.left)}, ` +
    `${boundText(interval.right)}` +
    `${interval.rightClosed ? ']' : ')'}`
  );
}

export function proveExactDomain(
  expression: string
): ExactDomainProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A function is required.'
    };
  }

  const ast = new ASTNormalizer().normalize(
    new ExpressionParser().parse(expression)
  );

  const conditions: Condition[] = [];

  if (!collect(ast, conditions)) {
    return {
      status: 'unsupported',
      reason:
        'This function is outside the exact domain ' +
        'proof grammar. No complete domain is claimed.'
    };
  }

  let intervals = fullLine();
  const steps: MathStep[] = [];

  for (let index = 0; index < conditions.length; index++) {
    const condition = conditions[index];

    const relation = condition.kind === 'nonzero'
      ? '!='
      : condition.kind === 'positive'
        ? '>'
        : '>=';

    const solved = solve(condition);

    if (solved === null) {
      return {
        status: 'unsupported',
        reason:
          'Complete exact ordering of polynomial ' +
          'constraint roots is not supported yet.'
      };
    }

    // Never certify an intersection whose endpoints
    // cannot be ordered exactly.
    const endpoints = [...intervals, ...solved]
      .flatMap(item => [item.left, item.right]);

    for (let i = 0; i < endpoints.length; i++) {
      for (let j = i + 1; j < endpoints.length; j++) {
        if (
          SetEngine.exactCompare(
            endpoints[i], endpoints[j]
          ) === null
        ) {
          return {
            status: 'unsupported',
            reason:
              'Exact comparison of domain endpoints ' +
              'could not be established.'
          };
        }
      }
    }

    intervals = SetEngine.intersection(
      intervals, solved
    );

    steps.push({
      id: `domain_exact_condition_${index + 1}`,
      title: 'Solve a necessary real-domain condition',
      explanation:
        `${condition.expression} ${relation} 0. ` +
        'The condition was solved with exact rational ' +
        'arithmetic and intersected with earlier conditions.'
    });
  }

  steps.push({
    id: 'domain_exact_completeness',
    title: 'Establish the real domain',
    explanation:
      'Every expression node belongs to the supported ' +
      'real-domain grammar. All partial operations have ' +
      'their conditions accounted for, so the intersection ' +
      'is the complete real domain for this input.'
  });

  return {
    status: 'verified',
    scope: 'supported_real_functions_polynomial_constraints',
    intervals,
    domain: intervals.length
      ? intervals.map(format)
      : ['empty set'],
    steps
  };
}
