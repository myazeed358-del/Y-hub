import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

export type QuarticMonotonicityProof =
  | {
      status: 'verified';
      scope: 'rational_quartic_complete_rational_derivative_roots';
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

function structuralDegree(
  node: CanonicalAST,
  budget: { remaining: number }
): number | null {
  budget.remaining--;

  if (budget.remaining < 0) return null;

  if (node.type === 'Number') {
    return /^-?\d+(?:\.\d{1,6})?$/.test(node.value) &&
      Math.abs(Number(node.value)) <= 1000000
      ? 0
      : null;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x' ? 1 : null;
  }

  if (node.type === 'Parenthesis') {
    return structuralDegree(node.content, budget);
  }

  if (node.type !== 'Operator') return null;

  if (node.operator === '^') {
    if (node.args.length !== 2) return null;

    const exponent = node.args[1];

    if (
      exponent.type !== 'Number' ||
      !/^[0-4]$/.test(exponent.value)
    ) {
      return null;
    }

    const baseDegree = structuralDegree(
      node.args[0],
      budget
    );

    if (baseDegree === null) return null;

    const result = baseDegree * Number(exponent.value);

    return result <= 4 ? result : null;
  }

  if (
    !['+', '-', '*', 'implicit_multiply']
      .includes(node.operator)
  ) {
    return null;
  }

  if (
    node.args.length === 0 ||
    (node.operator === '-' && node.args.length > 2)
  ) {
    return null;
  }

  const children = node.args.map(arg =>
    structuralDegree(arg, budget)
  );

  if (children.some(value => value === null)) {
    return null;
  }

  const values = children as number[];

  const result =
    node.operator === '*' ||
    node.operator === 'implicit_multiply'
      ? values.reduce((sum, value) => sum + value, 0)
      : Math.max(...values);

  return result <= 4 ? result : null;
}

function show(value: Rational): string {
  const r = Rat.simplify(value);

  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function negate(value: Rational): Rational {
  return { num: -value.num, den: value.den };
}

function compare(a: Rational, b: Rational): number {
  const left = a.num * b.den;
  const right = b.num * a.den;

  return left < right ? -1 : left > right ? 1 : 0;
}

function evaluate(
  coefficients: readonly Rational[],
  x: Rational
): Rational {
  let value = coefficients[0];

  for (const coefficient of coefficients.slice(1)) {
    value = Rat.add(
      Rat.mul(value, x),
      coefficient
    );
  }

  return value;
}

function integerCoefficients(
  coefficients: readonly Rational[]
): bigint[] | null {
  const values = coefficients.map(item =>
    Rat.simplify(item)
  );

  let common = 1n;

  for (const value of values) {
    common =
      (common / Rat.gcd(common, value.den)) *
      value.den;
  }

  const integers = values.map(value =>
    value.num * (common / value.den)
  );

  const gcd = integers.reduce(
    (current, value) => Rat.gcd(current, value),
    0n
  );

  if (gcd === 0n) return null;

  const primitive = integers.map(value =>
    value / gcd
  );

  // A deliberately conservative factoring budget.
  if (
    primitive.some(value =>
      absBigint(value) > 500000n
    )
  ) {
    return null;
  }

  return primitive;
}

function divisors(number: bigint): bigint[] {
  const n = Number(absBigint(number));

  if (n === 0 || n > 500000) return [];

  const result: bigint[] = [];

  for (let divisor = 1; divisor * divisor <= n; divisor++) {
    if (n % divisor !== 0) continue;

    result.push(BigInt(divisor));

    if (divisor * divisor !== n) {
      result.push(BigInt(n / divisor));
    }
  }

  return result;
}

function findRationalCubicRoot(
  coefficients: readonly Rational[]
): Rational | null {
  if (Rat.isZero(coefficients[3])) {
    return Rat.zero;
  }

  const integers = integerCoefficients(coefficients);

  if (!integers) return null;

  const numerators = divisors(integers[3]);
  const denominators = divisors(integers[0]);

  const tried = new Set<string>();

  for (const numerator of numerators) {
    for (const denominator of denominators) {
      for (const sign of [-1n, 1n]) {
        const candidate = Rat.simplify({
          num: sign * numerator,
          den: denominator
        });

        const key = show(candidate);

        if (tried.has(key)) continue;

        tried.add(key);

        if (
          Rat.isZero(evaluate(coefficients, candidate))
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
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

function rationalSquareRoot(
  value: Rational
): Rational | null {
  const r = Rat.simplify(value);

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

function completeRealDerivativeRoots(
  coefficients: readonly Rational[]
): {
  roots: Rational[];
  factorRoot: Rational;
  residualDiscriminant: Rational;
} | null {
  // The derivative is a genuine cubic:
  // Ax^3 + Bx^2 + Cx + D.
  const [A, B, C, D] = coefficients;

  if (Rat.isZero(A)) return null;

  const r = findRationalCubicRoot(coefficients);

  if (!r) return null;

  // Exact synthetic division by x-r.
  const E = Rat.add(B, Rat.mul(A, r));
  const F = Rat.add(C, Rat.mul(E, r));

  if (!Rat.isZero(Rat.add(D, Rat.mul(F, r)))) {
    return null;
  }

  const discriminant = Rat.sub(
    Rat.mul(E, E),
    Rat.mul(
      { num: 4n, den: 1n },
      Rat.mul(A, F)
    )
  );

  const roots = [r];

  if (discriminant.num >= 0n) {
    const sqrtDiscriminant =
      rationalSquareRoot(discriminant);

    // Positive nonsquare discriminant means that
    // completeness is not proved in this version.
    if (!sqrtDiscriminant) return null;

    const denominator = Rat.mul(
      { num: 2n, den: 1n },
      A
    );

    roots.push(
      Rat.div(
        Rat.sub(negate(E), sqrtDiscriminant),
        denominator
      ),
      Rat.div(
        Rat.add(negate(E), sqrtDiscriminant),
        denominator
      )
    );
  }

  const unique: Rational[] = [];

  for (const root of roots) {
    if (!unique.some(other => Rat.isEqual(root, other))) {
      unique.push(root);
    }
  }

  unique.sort(compare);

  return {
    roots: unique,
    factorRoot: r,
    residualDiscriminant: discriminant
  };
}

function interval(left: string, right: string): string {
  return `(${left}, ${right})`;
}

function sampleBetween(
  roots: readonly Rational[],
  index: number
): Rational {
  if (index === 0) {
    return Rat.sub(roots[0], Rat.one);
  }

  if (index === roots.length) {
    return Rat.add(roots[roots.length - 1], Rat.one);
  }

  return Rat.div(
    Rat.add(roots[index - 1], roots[index]),
    { num: 2n, den: 1n }
  );
}

export function proveQuarticMonotonicity(
  expression: string
): QuarticMonotonicityProof {
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
    structuralDegree(ast, { remaining: 150 }) !== 4
  ) {
    return {
      status: 'unsupported',
      reason:
        'This version requires a supported polynomial ' +
        'of structural degree four.'
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

  const [e, d, c, b, a] = series.terms.map(
    term => Rat.simplify(term)
  );

  if (Rat.isZero(a)) {
    return {
      status: 'unsupported',
      reason: 'The quartic coefficient vanishes.'
    };
  }

  const derivative = [
    Rat.mul({ num: 4n, den: 1n }, a),
    Rat.mul({ num: 3n, den: 1n }, b),
    Rat.mul({ num: 2n, den: 1n }, c),
    d
  ];

  const complete = completeRealDerivativeRoots(
    derivative
  );

  if (!complete) {
    return {
      status: 'unsupported',
      reason:
        'A complete exact rational-root analysis of ' +
        'the cubic derivative was not established.'
    };
  }

  const roots = complete.roots;
  const signs: number[] = [];
  const witnesses: string[] = [];

  // The roots are complete and exact. Between consecutive
  // roots the derivative is continuous and cannot change
  // sign without an additional root.
  for (let index = 0; index <= roots.length; index++) {
    const witness = sampleBetween(roots, index);
    const value = evaluate(derivative, witness);

    if (Rat.isZero(value)) {
      return {
        status: 'unsupported',
        reason: 'Derivative sign certification failed.'
      };
    }

    signs.push(value.num > 0n ? 1 : -1);

    witnesses.push(
      `At x = ${show(witness)}, ` +
      `f'(x) = ${show(value)} ` +
      `(${value.num > 0n ? 'positive' : 'negative'}).`
    );
  }

  const increasingIntervals: string[] = [];
  const decreasingIntervals: string[] = [];

  // Merge adjacent intervals when a stationary point
  // does not change the derivative sign.
  for (let start = 0; start < signs.length;) {
    let end = start;

    while (
      end + 1 < signs.length &&
      signs[end + 1] === signs[start]
    ) {
      end++;
    }

    const left = start === 0
      ? '-infinity'
      : show(roots[start - 1]);

    const right = end === roots.length
      ? '+infinity'
      : show(roots[end]);

    const target = signs[start] > 0
      ? increasingIntervals
      : decreasingIntervals;

    target.push(interval(left, right));

    start = end + 1;
  }

  const extrema: Array<{
    type: 'local_minimum' | 'local_maximum';
    x: string;
    y: string;
  }> = [];

  for (let index = 0; index < roots.length; index++) {
    const before = signs[index];
    const after = signs[index + 1];

    if (before === after) continue;

    extrema.push({
      type: before < 0
        ? 'local_minimum'
        : 'local_maximum',
      x: show(roots[index]),
      y: show(evaluate([a, b, c, d, e], roots[index]))
    });
  }

  const steps: MathStep[] = [
    {
      id: 'quartic_exact_coefficients',
      title: 'Extract exact quartic coefficients',
      explanation:
        `f(x) = (${show(a)})x^4 + (${show(b)})x^3 + ` +
        `(${show(c)})x^2 + (${show(d)})x + (${show(e)}).`
    },
    {
      id: 'quartic_exact_derivative',
      title: 'Form the exact cubic derivative',
      explanation:
        `f'(x) = (${show(derivative[0])})x^3 + ` +
        `(${show(derivative[1])})x^2 + ` +
        `(${show(derivative[2])})x + ` +
        `(${show(derivative[3])}).`
    },
    {
      id: 'quartic_complete_roots',
      title: 'Prove completeness of the critical points',
      explanation:
        `The derivative has an exact rational root ` +
        `${show(complete.factorRoot)}. ` +
        'Synthetic division gives a quadratic factor ' +
        `with discriminant ${show(
          complete.residualDiscriminant
        )}. ` +
        'All real roots of both factors have been resolved. ' +
        `The distinct critical points are: ` +
        `${roots.map(show).join(', ')}.`
    },
    {
      id: 'quartic_sign_certification',
      title: 'Prove derivative signs on every interval',
      explanation:
        witnesses.join(' ') +
        ' Because these are all the real derivative roots, ' +
        'the sign is constant between consecutive roots.'
    },
    {
      id: 'quartic_extrema',
      title: 'Classify the local extrema',
      explanation:
        extrema.length > 0
          ? extrema.map(item =>
              `${item.type} at (${item.x}, ${item.y})`
            ).join('; ') + '.'
          : 'No derivative sign change produces a local extremum.'
    }
  ];

  return {
    status: 'verified',
    scope: 'rational_quartic_complete_rational_derivative_roots',
    degree: 4,
    criticalPoints: roots.map(show),
    increasingIntervals,
    decreasingIntervals,
    extrema,
    steps
  };
}
