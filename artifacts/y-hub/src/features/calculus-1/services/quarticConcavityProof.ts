import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

export type QuarticConcavityProof =
  | {
      status: 'verified';
      scope: 'exact_rational_quartic_second_derivative';
      degree: 4;
      concaveUpIntervals: string[];
      concaveDownIntervals: string[];
      inflectionPoints: Array<{
        x: string;
        y: string;
      }>;
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

interface RadicalNumber {
  // Exact representation u + v*sqrt(D).
  u: Rational;
  v: Rational;
}

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

    const baseDegree = polynomialDegree(
      ast.args[0],
      budget
    );

    if (baseDegree === null) return null;

    const total =
      baseDegree * Number(exponent.value);

    return total <= 4 ? total : null;
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

  if (degrees.some(value => value === null)) {
    return null;
  }

  const values = degrees as number[];

  const total =
    ast.operator === '*' ||
    ast.operator === 'implicit_multiply'
      ? values.reduce((sum, value) => sum + value, 0)
      : Math.max(...values);

  return total <= 4 ? total : null;
}

function show(value: Rational): string {
  const r = Rat.simplify(value);

  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function negate(value: Rational): Rational {
  return { num: -value.num, den: value.den };
}

function add(
  left: RadicalNumber,
  right: RadicalNumber
): RadicalNumber {
  return {
    u: Rat.add(left.u, right.u),
    v: Rat.add(left.v, right.v)
  };
}

function multiply(
  left: RadicalNumber,
  right: RadicalNumber,
  D: Rational
): RadicalNumber {
  return {
    u: Rat.add(
      Rat.mul(left.u, right.u),
      Rat.mul(D, Rat.mul(left.v, right.v))
    ),
    v: Rat.add(
      Rat.mul(left.u, right.v),
      Rat.mul(left.v, right.u)
    )
  };
}

function evaluateQuartic(
  coefficients: readonly Rational[],
  x: RadicalNumber,
  D: Rational
): RadicalNumber {
  // Exact Horner evaluation in Q(sqrt(D)).
  let result: RadicalNumber = {
    u: coefficients[0],
    v: Rat.zero
  };

  for (const coefficient of coefficients.slice(1)) {
    result = add(
      multiply(result, x, D),
      { u: coefficient, v: Rat.zero }
    );
  }

  return result;
}

function showRadical(
  value: RadicalNumber,
  D: Rational
): string {
  const u = Rat.simplify(value.u);
  const v = Rat.simplify(value.v);

  if (Rat.isZero(v)) return show(u);

  const absolute = {
    num: v.num < 0n ? -v.num : v.num,
    den: v.den
  };

  const coefficient = Rat.isEqual(absolute, Rat.one)
    ? ''
    : `(${show(absolute)})*`;

  const radical = `${coefficient}sqrt(${show(D)})`;

  if (Rat.isZero(u)) {
    return v.num < 0n
      ? `-${radical}`
      : radical;
  }

  return `${show(u)}${v.num < 0n ? '-' : '+'}${radical}`;
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

function exactRationalSquareRoot(
  number: Rational
): Rational | null {
  const r = Rat.simplify(number);

  if (r.num < 0n) return null;

  const numerator = squareRootInteger(r.num);
  const denominator = squareRootInteger(r.den);

  if (numerator === null || denominator === null) {
    return null;
  }

  return Rat.simplify({
    num: numerator,
    den: denominator
  });
}

function interval(left: string, right: string): string {
  return `(${left}, ${right})`;
}

function constantSignProof(
  A: Rational,
  B: Rational,
  D: Rational,
  coefficients: readonly Rational[],
  steps: MathStep[]
): QuarticConcavityProof {
  const positive = A.num > 0n;

  if (Rat.isZero(D)) {
    const root = Rat.div(
      negate(B),
      Rat.mul({ num: 2n, den: 1n }, A)
    );

    steps.push({
      id: 'quartic_concavity_double_root',
      title: 'Analyze the repeated second-derivative root',
      explanation:
        `f''(x) = (${show(A)})(x - (${show(root)}))^2. ` +
        'Its sign does not change at the double root. ' +
        'Therefore this point is not an inflection point.'
    });
  } else {
    steps.push({
      id: 'quartic_concavity_negative_discriminant',
      title: 'Prove the second derivative has constant sign',
      explanation:
        `The discriminant ${show(D)} is negative. ` +
        'The quadratic second derivative has no real roots, ' +
        'so its sign equals the sign of its leading coefficient.'
    });
  }

  // D <= 0: the second derivative never changes sign.
  return {
    status: 'verified',
    scope: 'exact_rational_quartic_second_derivative',
    degree: 4,
    concaveUpIntervals: positive
      ? [interval('-infinity', '+infinity')]
      : [],
    concaveDownIntervals: positive
      ? []
      : [interval('-infinity', '+infinity')],
    inflectionPoints: [],
    steps
  };
}

export function proveQuarticConcavity(
  expression: string
): QuarticConcavityProof {
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
        'This proof requires a supported degree-four ' +
        'polynomial in x with rational coefficients.'
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
      reason: 'Exact quartic coefficients are unavailable.'
    };
  }

  // f(x) = ax^4 + bx^3 + cx^2 + dx + e.
  const [e, d, c, b, a] = series.terms.map(
    term => Rat.simplify(term)
  );

  if (Rat.isZero(a)) {
    return {
      status: 'unsupported',
      reason:
        'The quartic coefficient vanishes after expansion.'
    };
  }

  // f''(x) = A*x^2 + B*x + C.
  const A = Rat.mul({ num: 12n, den: 1n }, a);
  const B = Rat.mul({ num: 6n, den: 1n }, b);
  const C = Rat.mul({ num: 2n, den: 1n }, c);

  const D = Rat.sub(
    Rat.mul(B, B),
    Rat.mul(
      { num: 4n, den: 1n },
      Rat.mul(A, C)
    )
  );

  const steps: MathStep[] = [
    {
      id: 'quartic_concavity_exact_coefficients',
      title: 'Extract exact quartic coefficients',
      explanation:
        `f(x) = (${show(a)})x^4 + (${show(b)})x^3 + ` +
        `(${show(c)})x^2 + (${show(d)})x + (${show(e)}).`
    },
    {
      id: 'quartic_concavity_discriminant',
      title: 'Calculate the exact second-derivative discriminant',
      explanation:
        `f''(x) = (${show(A)})x^2 + (${show(B)})x + ` +
        `(${show(C)}). The exact discriminant is ` +
        `${show(D)}.`
    }
  ];

  if (D.num <= 0n) {
    return constantSignProof(
      A,
      B,
      D,
      [a, b, c, d, e],
      steps
    );
  }

  // D > 0 gives exactly two distinct real roots.
  const midpoint = Rat.div(
    negate(B),
    Rat.mul({ num: 2n, den: 1n }, A)
  );

  const absoluteA = {
    num: A.num < 0n ? -A.num : A.num,
    den: A.den
  };

  const denominator = Rat.mul(
    { num: 2n, den: 1n },
    absoluteA
  );

  const sqrtD = exactRationalSquareRoot(D);

  let left: RadicalNumber;
  let right: RadicalNumber;

  if (sqrtD) {
    const radius = Rat.div(sqrtD, denominator);

    left = {
      u: Rat.sub(midpoint, radius),
      v: Rat.zero
    };

    right = {
      u: Rat.add(midpoint, radius),
      v: Rat.zero
    };
  } else {
    const factor = Rat.div(Rat.one, denominator);

    left = {
      u: midpoint,
      v: negate(factor)
    };

    right = {
      u: midpoint,
      v: factor
    };
  }

  // The positive radius guarantees x1 < x2.
  const x1 = showRadical(left, D);
  const x2 = showRadical(right, D);

  const coefficients = [a, b, c, d, e];

  const y1 = showRadical(
    evaluateQuartic(coefficients, left, D),
    D
  );

  const y2 = showRadical(
    evaluateQuartic(coefficients, right, D),
    D
  );

  const positiveOutside = A.num > 0n;

  steps.push(
    {
      id: 'quartic_concavity_exact_roots',
      title: 'Find all exact second-derivative roots',
      explanation:
        `The positive discriminant gives exactly two ` +
        `real roots, ordered x1 = ${x1} < x2 = ${x2}. ` +
        'Both roots are represented exactly.'
    },
    {
      id: 'quartic_concavity_sign_proof',
      title: 'Establish both concavity changes',
      explanation:
        `f''(x) = (${show(A)})(x-x1)(x-x2). ` +
        (positiveOutside
          ? 'It is positive outside the roots and negative between them.'
          : 'It is negative outside the roots and positive between them.') +
        ' Thus both roots are genuine inflection points.'
    },
    {
      id: 'quartic_concavity_exact_inflections',
      title: 'Evaluate the inflection points exactly',
      explanation:
        `The exact inflection points are (${x1}, ${y1}) ` +
        `and (${x2}, ${y2}).`
    }
  );

  return {
    status: 'verified',
    scope: 'exact_rational_quartic_second_derivative',
    degree: 4,
    concaveUpIntervals: positiveOutside
      ? [
          interval('-infinity', x1),
          interval(x2, '+infinity')
        ]
      : [interval(x1, x2)],
    concaveDownIntervals: positiveOutside
      ? [interval(x1, x2)]
      : [
          interval('-infinity', x1),
          interval(x2, '+infinity')
        ],
    inflectionPoints: [
      { x: x1, y: y1 },
      { x: x2, y: y2 }
    ],
    steps
  };
}
