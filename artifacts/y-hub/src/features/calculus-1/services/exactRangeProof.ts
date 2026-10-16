import { ExpressionParser } from '@/services/math/parser';
import {
  proveCertifiedQuarticRange
} from './quarticRangeProof';
import {
  proveCubicMonotonicity
} from './cubicMonotonicityProof';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { Endpoint, Interval } from '@/services/math/types/set';
import type { MathStep } from '@/services/math/types/step';
import {
  extractQuadraticDomainPolynomial
} from './quadraticDomainConstraints';

export type ExactRangeProof =
  | {
      status: 'verified';
      scope:
        | 'real_polynomials_degree_0_to_2'
        | 'verified_rational_cubic_surjectivity'
        | 'verified_quartic_global_range';
      range: string[];
      intervals: Interval[];
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

function show(value: Rational): string {
  const r = Rat.simplify(value);
  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function point(value: Rational): Endpoint {
  const rational = Rat.simplify(value);
  return {
    type: 'value',
    ast: {
      type: 'Number',
      value: show(rational)
    },
    rational
  };
}

const negativeInfinity: Endpoint = {
  type: 'infinity',
  sign: -1
};

const positiveInfinity: Endpoint = {
  type: 'infinity',
  sign: 1
};

function formatEndpoint(value: Endpoint): string {
  if (value.type === 'infinity') {
    return value.sign === -1
      ? '-infinity'
      : '+infinity';
  }

  return value.rational
    ? show(value.rational)
    : 'unsupported endpoint';
}

function format(interval: Interval): string {
  return (
    `${interval.leftClosed ? '[' : '('}` +
    `${formatEndpoint(interval.left)}, ` +
    `${formatEndpoint(interval.right)}` +
    `${interval.rightClosed ? ']' : ')'}`
  );
}

export function proveExactRange(
  expression: string
): ExactRangeProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A function is required.'
    };
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const ast = normalizer.normalize(
    parser.parse(expression)
  );

  const coefficients =
    extractQuadraticDomainPolynomial(ast);

  if (!coefficients) {
    // Reuse the independent cubic polynomial certificate.
    // Local extrema are not used to determine the range.
    const cubic = proveCubicMonotonicity(expression);

    if (cubic.status === 'verified' && cubic.degree === 3) {
      const intervals: Interval[] = [{
        left: negativeInfinity,
        right: positiveInfinity,
        leftClosed: false,
        rightClosed: false
      }];

      return {
        status: 'verified',
        scope: 'verified_rational_cubic_surjectivity',
        intervals,
        range: intervals.map(format),
        steps: [
          ...cubic.steps,
          {
            id: 'range_cubic_end_behavior',
            title: 'Use the nonzero cubic leading coefficient',
            explanation:
              'The verified polynomial has degree three and ' +
              'a nonzero real leading coefficient. Its leading ' +
              'term dominates at both infinities, producing ' +
              'opposite infinite limits.'
          },
          {
            id: 'range_cubic_intermediate_value',
            title: 'Apply continuity and the intermediate value theorem',
            explanation:
              'A polynomial is continuous on the real line. ' +
              'Between its opposite infinite end behaviors, ' +
              'it attains every real output. Its range is R.'
          }
        ]
      };
    }

    const quartic = proveCertifiedQuarticRange(expression);

    if (quartic.status === 'verified') {
      const endpoint = point(quartic.bound);

      const intervals: Interval[] =
        quartic.direction === 'minimum'
          ? [{
              left: endpoint,
              right: positiveInfinity,
              leftClosed: true,
              rightClosed: false
            }]
          : [{
              left: negativeInfinity,
              right: endpoint,
              leftClosed: false,
              rightClosed: true
            }];

      return {
        status: 'verified',
        scope: 'verified_quartic_global_range',
        intervals,
        range: intervals.map(format),
        steps: quartic.steps
      };
    }

    return {
      status: 'unsupported',
      reason:
        'A complete exact range proof is unavailable ' +
        'for this function. Supported cases include ' +
        'degree zero through two, certified cubics, ' +
        'and certified quartics.'
    };
  }

  const { a, b, c } = coefficients;
  const steps: MathStep[] = [];
  let intervals: Interval[];

  if (Rat.isZero(a) && Rat.isZero(b)) {
    const value = point(c);

    intervals = [{
      left: value,
      right: value,
      leftClosed: true,
      rightClosed: true
    }];

    steps.push({
      id: 'range_constant',
      title: 'Recognize a constant function',
      explanation:
        `The function equals ${show(c)} for every real x.`
    });

  } else if (Rat.isZero(a)) {
    intervals = [{
      left: negativeInfinity,
      right: positiveInfinity,
      leftClosed: false,
      rightClosed: false
    }];

    steps.push({
      id: 'range_linear',
      title: 'Recognize a nonconstant linear function',
      explanation:
        `The coefficient of x is ${show(b)}, ` +
        'which is nonzero. Every real output occurs ' +
        'for exactly one real input.'
    });

  } else {
    const four = { num: 4n, den: 1n };

    const vertexValue = Rat.sub(
      c,
      Rat.div(
        Rat.mul(b, b),
        Rat.mul(four, a)
      )
    );

    const vertex = point(vertexValue);
    const opensUpward = a.num > 0n;

    intervals = opensUpward
      ? [{
          left: vertex,
          right: positiveInfinity,
          leftClosed: true,
          rightClosed: false
        }]
      : [{
          left: negativeInfinity,
          right: vertex,
          leftClosed: false,
          rightClosed: true
        }];

    steps.push({
      id: 'range_complete_square',
      title: 'Complete the square',
      explanation:
        `f(x) = a(x + b/(2a))^2 + k, ` +
        `where a = ${show(a)}, b = ${show(b)}, ` +
        `and k = c - b^2/(4a) = ${show(vertexValue)}.`
    });

    steps.push({
      id: 'range_square_sign',
      title: 'Use the nonnegative square',
      explanation: opensUpward
        ? `Since a > 0, the minimum is ${show(vertexValue)}.`
        : `Since a < 0, the maximum is ${show(vertexValue)}.`
    });

    steps.push({
      id: 'range_attainability',
      title: 'Prove the range is complete',
      explanation:
        'The vertex value is attained at x = -b/(2a). ' +
        'The squared term takes every nonnegative real ' +
        'value, so every claimed output is attainable.'
    });
  }

  return {
    status: 'verified',
    scope: 'real_polynomials_degree_0_to_2',
    intervals,
    range: intervals.map(format),
    steps
  };
}
