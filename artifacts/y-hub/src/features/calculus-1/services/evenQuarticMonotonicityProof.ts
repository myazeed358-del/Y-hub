import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

export type EvenQuarticMonotonicityProof =
  | {
      status: 'verified';
      scope: 'exact_even_quartic_irrational_stationary_roots';
      degree: 4;
      criticalPoints: string[];
      increasingIntervals: string[];
      decreasingIntervals: string[];
      extrema: Array<{
        type: 'local_minimum' | 'local_maximum';
        x: string;
        y: string;
      }>;
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

function polynomialDegree(
  ast: CanonicalAST,
  budget: { remaining: number }
): number | null {
  budget.remaining--;

  if (budget.remaining < 0) return null;

  if (ast.type === 'Number') {
    return /^-?\d+(?:\.\d{1,6})?$/.test(ast.value) &&
      Math.abs(Number(ast.value)) <= 1000000
      ? 0
      : null;
  }

  if (ast.type === 'Symbol') {
    return ast.name === 'x' ? 1 : null;
  }

  if (ast.type === 'Parenthesis') {
    return polynomialDegree(ast.content, budget);
  }

  if (ast.type !== 'Operator') return null;

  if (ast.operator === '^') {
    if (ast.args.length !== 2) return null;

    const exponent = ast.args[1];

    if (
      exponent.type !== 'Number' ||
      !/^[0-4]$/.test(exponent.value)
    ) {
      return null;
    }

    const d = polynomialDegree(
      ast.args[0],
      budget
    );

    if (d === null) return null;

    const result = d * Number(exponent.value);
    return result <= 4 ? result : null;
  }

  if (
    !['+', '-', '*', 'implicit_multiply']
      .includes(ast.operator)
  ) {
    return null;
  }

  if (
    ast.args.length === 0 ||
    (ast.operator === '-' && ast.args.length > 2)
  ) {
    return null;
  }

  const degrees = ast.args.map(arg =>
    polynomialDegree(arg, budget)
  );

  if (degrees.some(d => d === null)) return null;

  const values = degrees as number[];

  const result =
    ast.operator === '*' ||
    ast.operator === 'implicit_multiply'
      ? values.reduce((sum, d) => sum + d, 0)
      : Math.max(...values);

  return result <= 4 ? result : null;
}

function show(value: Rational): string {
  const r = Rat.simplify(value);

  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function squareRootInteger(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;

  let current =
    1n << BigInt(Math.ceil(n.toString(2).length / 2));

  while (true) {
    const next = (current + n / current) / 2n;

    if (next >= current) {
      return current * current === n
        ? current
        : null;
    }

    current = next;
  }
}

function isRationalSquare(value: Rational): boolean {
  const r = Rat.simplify(value);

  return (
    r.num >= 0n &&
    squareRootInteger(r.num) !== null &&
    squareRootInteger(r.den) !== null
  );
}

function between(left: string, right: string): string {
  return `(${left}, ${right})`;
}

export function proveEvenQuarticMonotonicity(
  expression: string
): EvenQuarticMonotonicityProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A function is required.'
    };
  }

  const ast = new ASTNormalizer().normalize(
    new ExpressionParser().parse(expression)
  );

  if (
    polynomialDegree(ast, { remaining: 150 }) !== 4
  ) {
    return {
      status: 'unsupported',
      reason:
        'This proof requires a supported quartic polynomial.'
    };
  }

  const series = new LocalSeriesEngine().expand(
    ast,
    'x',
    0,
    4
  );

  if (!series || series.terms.length !== 5) {
    return {
      status: 'unsupported',
      reason:
        'Exact polynomial coefficients are unavailable.'
    };
  }

  // f(x) = ax^4 + bx^3 + cx^2 + dx + e.
  const [e, d, c, b, a] = series.terms.map(
    value => Rat.simplify(value)
  );

  if (
    Rat.isZero(a) ||
    !Rat.isZero(b) ||
    !Rat.isZero(d)
  ) {
    return {
      status: 'unsupported',
      reason:
        'Only genuine even quartics ax^4 + cx^2 + e ' +
        'are supported by this specialized proof.'
    };
  }

  // f'(x) = 2x(2ax^2+c).
  // The nonzero critical roots have x^2=t.
  const t = Rat.div(
    { num: -c.num, den: c.den },
    Rat.mul({ num: 2n, den: 1n }, a)
  );

  if (t.num <= 0n) {
    return {
      status: 'unsupported',
      reason:
        'No pair of nonzero real stationary roots ' +
        'needs this specialized proof.'
    };
  }

  if (isRationalSquare(t)) {
    return {
      status: 'unsupported',
      reason:
        'The roots are rational and belong to the ' +
        'existing quartic proof engine.'
    };
  }

  const radius = `sqrt(${show(t)})`;
  const left = `-${radius}`;
  const right = radius;

  // Exact substitution x^2=t:
  // f(+-sqrt(t)) = e - c^2/(4a).
  const outerValue = Rat.sub(
    e,
    Rat.div(
      Rat.mul(c, c),
      Rat.mul({ num: 4n, den: 1n }, a)
    )
  );

  const outsideValue = show(outerValue);
  const centerValue = show(e);

  const opensUp = a.num > 0n;

  const increasingIntervals = opensUp
    ? [
        between(left, '0'),
        between(right, '+infinity')
      ]
    : [
        between('-infinity', left),
        between('0', right)
      ];

  const decreasingIntervals = opensUp
    ? [
        between('-infinity', left),
        between('0', right)
      ]
    : [
        between(left, '0'),
        between(right, '+infinity')
      ];

  const extrema: Array<{
    type: 'local_minimum' | 'local_maximum';
    x: string;
    y: string;
  }> = [
    {
      type: opensUp ? 'local_minimum' : 'local_maximum',
      x: left,
      y: outsideValue
    },
    {
      type: opensUp ? 'local_maximum' : 'local_minimum',
      x: '0',
      y: centerValue
    },
    {
      type: opensUp ? 'local_minimum' : 'local_maximum',
      x: right,
      y: outsideValue
    }
  ];

  const steps: MathStep[] = [
    {
      id: 'even_quartic_coefficients',
      title: 'Extract the exact even-quartic coefficients',
      explanation:
        `f(x) = (${show(a)})x^4 + ` +
        `(${show(c)})x^2 + (${show(e)}).`
    },
    {
      id: 'even_quartic_factor_derivative',
      title: 'Factor the first derivative exactly',
      explanation:
        `f'(x) = 2x(2(${show(a)})x^2 + ` +
        `(${show(c)})).`
    },
    {
      id: 'even_quartic_complete_roots',
      title: 'Find all real stationary points',
      explanation:
        `Since x^2 = ${show(t)} > 0, ` +
        `the complete real derivative-root set is ` +
        `{${left}, 0, ${right}}. ` +
        'The radical endpoints are represented exactly.'
    },
    {
      id: 'even_quartic_sign_chart',
      title: 'Certify derivative signs',
      explanation:
        `The factorization is f'(x) = ` +
        `4(${show(a)})x(x-${radius})(x+${radius}). ` +
        'The three distinct roots partition the real line. ' +
        (opensUp
          ? 'The signs from left to right are negative, ' +
            'positive, negative, positive.'
          : 'The signs from left to right are positive, ' +
            'negative, positive, negative.')
    },
    {
      id: 'even_quartic_exact_extrema',
      title: 'Classify and evaluate all local extrema',
      explanation:
        `At x = ${left} and x = ${right}, ` +
        `f(x) = ${outsideValue}. ` +
        `At x = 0, f(x) = ${centerValue}. ` +
        'The derivative sign changes establish the ' +
        'three local extrema.'
    }
  ];

  return {
    status: 'verified',
    scope: 'exact_even_quartic_irrational_stationary_roots',
    degree: 4,
    criticalPoints: [left, '0', right],
    increasingIntervals,
    decreasingIntervals,
    extrema,
    steps
  };
}
