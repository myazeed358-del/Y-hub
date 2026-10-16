import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { MathStep } from '@/services/math/types/step';
import {
  proveQuarticMonotonicity
} from './quarticMonotonicityProof';
import {
  proveEvenQuarticMonotonicity
} from './evenQuarticMonotonicityProof';

export type CertifiedQuarticRange =
  | {
      status: 'verified';
      direction: 'minimum' | 'maximum';
      bound: Rational;
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

function parseRational(value: string): Rational | null {
  const match = /^(-?\d{1,128})(?:\/([1-9]\d{0,127}))?$/
    .exec(value);

  if (!match) return null;

  return Rat.simplify({
    num: BigInt(match[1]),
    den: BigInt(match[2] ?? '1')
  });
}

function show(value: Rational): string {
  const r = Rat.simplify(value);
  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function compare(a: Rational, b: Rational): number {
  const difference = Rat.sub(a, b);
  return difference.num < 0n
    ? -1
    : difference.num > 0n
      ? 1
      : 0;
}

/**
 * Convert a complete, independently verified quartic
 * monotonicity certificate into its global real range bound.
 *
 * A genuine quartic diverges in the same direction at
 * both infinities. Its first genuine local extremum
 * determines that direction.
 *
 * The certificate guarantees that all real stationary
 * points and derivative sign changes were resolved.
 */
export function proveCertifiedQuarticRange(
  expression: string
): CertifiedQuarticRange {
  const general = proveQuarticMonotonicity(expression);

  const proof = general.status === 'verified'
    ? general
    : proveEvenQuarticMonotonicity(expression);

  if (proof.status !== 'verified' || proof.degree !== 4) {
    return {
      status: 'unsupported',
      reason:
        'A complete verified quartic monotonicity ' +
        'certificate is unavailable.'
    };
  }

  const extrema = proof.extrema;

  // A real quartic has either one or three genuine
  // local extrema. Other shapes are not certified here.
  if (extrema.length !== 1 && extrema.length !== 3) {
    return {
      status: 'unsupported',
      reason:
        'The quartic extrema certificate has an ' +
        'unexpected structure.'
    };
  }

  const outerType = extrema[0].type;
  const innerType = outerType === 'local_minimum'
    ? 'local_maximum'
    : 'local_minimum';

  if (extrema.some((item, index) =>
    item.type !== (index % 2 === 0
      ? outerType
      : innerType)
  )) {
    return {
      status: 'unsupported',
      reason:
        'The certified extrema do not form the ' +
        'required quartic sign-change pattern.'
    };
  }

  // All extrema values must be exact rationals.
  // Unsupported symbolic formats are never rounded.
  const values = extrema.map(item =>
    parseRational(item.y)
  );

  if (values.some(value => value === null)) {
    return {
      status: 'unsupported',
      reason:
        'A quartic extremum cannot be compared ' +
        'as an exact rational.'
    };
  }

  const rationalValues = values as Rational[];

  const direction = outerType === 'local_minimum'
    ? 'minimum'
    : 'maximum';

  const candidates = rationalValues.filter(
    (_, index) => index % 2 === 0
  );

  let bound = candidates[0];

  for (const candidate of candidates.slice(1)) {
    const order = compare(candidate, bound);

    if (
      (direction === 'minimum' && order < 0) ||
      (direction === 'maximum' && order > 0)
    ) {
      bound = candidate;
    }
  }

  return {
    status: 'verified',
    direction,
    bound,
    steps: [
      ...proof.steps,
      {
        id: 'quartic_range_end_behavior',
        title: 'Certify the quartic end behavior',
        explanation:
          direction === 'minimum'
            ? 'The complete derivative sign certificate ' +
              'shows that this genuine quartic opens ' +
              'upward. Both infinite ends approach +infinity.'
            : 'The complete derivative sign certificate ' +
              'shows that this genuine quartic opens ' +
              'downward. Both infinite ends approach -infinity.'
      },
      {
        id: 'quartic_range_global_comparison',
        title: 'Compare all global extremum candidates',
        explanation:
          `The complete critical-point certificate gives ` +
          `${candidates.length} relevant ${direction} ` +
          `candidate(s). Exact rational comparison ` +
          `establishes the global ${direction} value ` +
          `${show(bound)}.`
      },
      {
        id: 'quartic_range_attainability',
        title: 'Prove the complete range',
        explanation:
          'The global extremum is attained at a real ' +
          'critical point. Continuity and the unbounded ' +
          'end behavior prove that every value from ' +
          'this bound toward the corresponding infinity ' +
          'is attained.'
      }
    ]
  };
}
