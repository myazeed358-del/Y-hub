import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { MathStep } from '@/services/math/types/step';
import {
  extractQuadraticDomainPolynomial
} from './quadraticDomainConstraints';

export type ExactInterceptProof =
  | {
      status: 'verified';
      scope: 'real_polynomials_degree_0_to_2_exact_roots';
      yIntercept: { x: '0'; y: string };
      xIntercepts:
        | { kind: 'finite'; roots: string[] }
        | { kind: 'all_real' };
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

const minusOne = { num: -1n, den: 1n };
const two = { num: 2n, den: 1n };
const four = { num: 4n, den: 1n };

function show(value: Rational): string {
  const r = Rat.simplify(value);
  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function neg(value: Rational): Rational {
  return Rat.mul(value, minusOne);
}

function sign(value: Rational): number {
  const r = Rat.simplify(value);
  return r.num < 0n ? -1 : r.num > 0n ? 1 : 0;
}

function compare(left: Rational, right: Rational): number {
  return sign(Rat.sub(left, right));
}

// Exact integer square root: no floating-point rounding.
function perfectSquareRoot(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;

  let x = n;
  let next = (x + 1n) / 2n;

  while (next < x) {
    x = next;
    next = (x + n / x) / 2n;
  }

  return x * x === n ? x : null;
}

function rationalSquareRoot(
  value: Rational
): Rational | null {
  const normalized = Rat.simplify(value);

  if (normalized.num < 0n) return null;

  const num = perfectSquareRoot(normalized.num);
  const den = perfectSquareRoot(normalized.den);

  if (num === null || den === null) return null;

  return Rat.simplify({ num, den });
}

function step(
  id: string,
  title: string,
  explanation: string
): MathStep {
  return { id, title, explanation };
}

function verified(
  c: Rational,
  roots: Rational[] | 'all_real',
  steps: MathStep[]
): ExactInterceptProof {
  if (roots === 'all_real') {
    return {
      status: 'verified',
      scope: 'real_polynomials_degree_0_to_2_exact_roots',
      yIntercept: { x: '0', y: show(c) },
      xIntercepts: { kind: 'all_real' },
      steps
    };
  }

  const sorted = [...roots].sort(compare);
  const unique = sorted.filter(
    (root, index) =>
      index === 0 || compare(root, sorted[index - 1]) !== 0
  );

  return {
    status: 'verified',
    scope: 'real_polynomials_degree_0_to_2_exact_roots',
    yIntercept: { x: '0', y: show(c) },
    xIntercepts: {
      kind: 'finite',
      roots: unique.map(show)
    },
    steps
  };
}

export function proveExactIntercepts(
  expression: string
): ExactInterceptProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A mathematical function is required.'
    };
  }

  try {
    const ast = new ASTNormalizer().normalize(
      new ExpressionParser().parse(expression)
    );

    const polynomial =
      extractQuadraticDomainPolynomial(ast);

    if (!polynomial) {
      return {
        status: 'unsupported',
        reason:
          'Complete intercept proof currently supports ' +
          'real polynomials of degree at most two.'
      };
    }

    const { a, b, c } = polynomial;

    const steps: MathStep[] = [
      step(
        'intercept_y',
        'Find the y-intercept',
        `Substitute x = 0. The exact result is f(0) = ${show(c)}.`
      )
    ];

    if (Rat.isZero(a) && Rat.isZero(b)) {
      if (Rat.isZero(c)) {
        steps.push(step(
          'intercept_zero_function',
          'Solve f(x) = 0',
          'The function is identically zero. Every real x ' +
          'is an x-intercept, and the y-intercept is (0, 0).'
        ));
        return verified(c, 'all_real', steps);
      }

      steps.push(step(
        'intercept_nonzero_constant',
        'Solve f(x) = 0',
        'A nonzero constant never equals zero, ' +
        'so there are no x-intercepts.'
      ));

      return verified(c, [], steps);
    }

    if (Rat.isZero(a)) {
      const root = Rat.div(neg(c), b);

      steps.push(step(
        'intercept_linear_root',
        'Solve the linear equation exactly',
        `Since b = ${show(b)} is nonzero, ` +
        `bx + c = 0 has the unique root x = ${show(root)}.`
      ));

      return verified(c, [root], steps);
    }

    const discriminant = Rat.sub(
      Rat.mul(b, b),
      Rat.mul(four, Rat.mul(a, c))
    );

    steps.push(step(
      'intercept_quadratic_discriminant',
      'Compute the exact discriminant',
      `For ax^2 + bx + c, D = b^2 - 4ac = ` +
      `${show(discriminant)}.`
    ));

    if (sign(discriminant) < 0) {
      steps.push(step(
        'intercept_negative_discriminant',
        'Prove there are no real roots',
        'The discriminant is negative and a is nonzero. ' +
        'The quadratic has no real zeros.'
      ));

      return verified(c, [], steps);
    }

    const denominator = Rat.mul(two, a);
    const negativeB = neg(b);

    if (Rat.isZero(discriminant)) {
      const root = Rat.div(negativeB, denominator);

      steps.push(step(
        'intercept_double_root',
        'Find the repeated real root',
        `The discriminant is zero. The only real root ` +
        `is x = ${show(root)}.`
      ));

      return verified(c, [root], steps);
    }

    const radical = rationalSquareRoot(discriminant);

    if (radical === null) {
      // x = m +/- sqrt(q), where:
      // m = -b/(2a) and q = D/(4a^2) > 0.
      const midpoint = Rat.div(negativeB, denominator);

      const radicand = Rat.div(
        discriminant,
        Rat.mul(denominator, denominator)
      );

      if (sign(radicand) <= 0) {
        return {
          status: 'unsupported',
          reason: 'Invalid symbolic radical certificate.'
        };
      }

      const radicalText = `sqrt(${show(radicand)})`;
      const middle = show(midpoint);

      const left = Rat.isZero(midpoint)
        ? `-${radicalText}`
        : `${middle}-${radicalText}`;

      const right = Rat.isZero(midpoint)
        ? radicalText
        : `${middle}+${radicalText}`;

      steps.push(step(
        'intercept_two_irrational_roots',
        'Apply the exact quadratic formula',
        `Write x = m +/- sqrt(q), where ` +
        `m = -b/(2a) = ${middle} and ` +
        `q = D/(4a^2) = ${show(radicand)} > 0. ` +
        `The two roots, in increasing order, are ` +
        `x = ${left} and x = ${right}. ` +
        `The nonsquare rational discriminant proves ` +
        `these roots are irrational.`
      ));

      return {
        status: 'verified',
        scope: 'real_polynomials_degree_0_to_2_exact_roots',
        yIntercept: { x: '0', y: show(c) },
        xIntercepts: {
          kind: 'finite',
          roots: [left, right]
        },
        steps
      };
    }

    const root1 = Rat.div(
      Rat.sub(negativeB, radical),
      denominator
    );

    const root2 = Rat.div(
      Rat.add(negativeB, radical),
      denominator
    );

    steps.push(step(
      'intercept_two_rational_roots',
      'Apply the quadratic formula exactly',
      `The positive discriminant has an exact rational ` +
      `square root. All real solutions are ` +
      `x = ${show(root1)} and x = ${show(root2)}.`
    ));

    return verified(c, [root1, root2], steps);
  } catch {
    return {
      status: 'unsupported',
      reason:
        'The expression could not be parsed or ' +
        'certified within the supported scope.'
    };
  }
}
