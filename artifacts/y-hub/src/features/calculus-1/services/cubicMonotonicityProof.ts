import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

export type CubicMonotonicityProof =
  | {
      status: 'verified';
      scope: 'rational_cubic_exact_sign_analysis';
      degree: 3;
      criticalPoints: string[];
      increasingIntervals: string[];
      decreasingIntervals: string[];
      concaveUpIntervals: string[];
      concaveDownIntervals: string[];
      inflectionPoints: Array<{ x: string; y: string }>;
      extrema: Array<{
        type: 'local_maximum' | 'local_minimum';
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
      !/^[123]$/.test(exponent.value)
    ) {
      return null;
    }

    const baseDegree = polynomialDegree(
      ast.args[0], budget
    );

    if (baseDegree === null) return null;

    const result =
      baseDegree * Number(exponent.value);

    return result <= 3 ? result : null;
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

  const total = (
    ast.operator === '*' ||
    ast.operator === 'implicit_multiply'
  )
    ? values.reduce((sum, value) => sum + value, 0)
    : Math.max(...values);

  return total <= 3 ? total : null;
}

function show(value: Rational): string {
  const r = Rat.simplify(value);

  return r.den === 1n
    ? String(r.num)
    : `${r.num}/${r.den}`;
}

function compare(a: Rational, b: Rational): number {
  const left = a.num * b.den;
  const right = b.num * a.den;

  return left < right ? -1 : left > right ? 1 : 0;
}

function negate(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

function integerSquareRoot(n: bigint): bigint | null {
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
  const normalized = Rat.simplify(number);

  if (normalized.num < 0n) return null;

  const numerator = integerSquareRoot(normalized.num);
  const denominator = integerSquareRoot(normalized.den);

  if (numerator === null || denominator === null) {
    return null;
  }

  return Rat.simplify({
    num: numerator,
    den: denominator
  });
}

function evaluateCubic(
  coefficients: readonly Rational[],
  x: Rational
): Rational {
  // Coefficients ordered [a, b, c, d].
  let result = coefficients[0];

  for (const coefficient of coefficients.slice(1)) {
    result = Rat.add(
      Rat.mul(result, x),
      coefficient
    );
  }

  return result;
}

function fullLine(): string {
  return '(-infinity, +infinity)';
}

function between(left: string, right: string): string {
  return `(${left}, ${right})`;
}


// Represents u + v*sqrt(D), where every coefficient is
// an exact rational and D is a positive rational.
interface ExactSurd {
  u: Rational;
  v: Rational;
}

function addSurds(
  left: ExactSurd,
  right: ExactSurd
): ExactSurd {
  return {
    u: Rat.add(left.u, right.u),
    v: Rat.add(left.v, right.v)
  };
}

function multiplySurds(
  left: ExactSurd,
  right: ExactSurd,
  D: Rational
): ExactSurd {
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

function showSurd(
  value: ExactSurd,
  D: Rational
): string {
  const u = Rat.simplify(value.u);
  const v = Rat.simplify(value.v);

  if (Rat.isZero(v)) return show(u);

  const absoluteV = {
    num: v.num < 0n ? -v.num : v.num,
    den: v.den
  };

  const factor = Rat.isEqual(absoluteV, Rat.one)
    ? ''
    : `(${show(absoluteV)})*`;

  const radical = `${factor}sqrt(${show(D)})`;

  if (Rat.isZero(u)) {
    return v.num < 0n ? `-${radical}` : radical;
  }

  return (
    `${show(u)}` +
    `${v.num < 0n ? '-' : '+'}` +
    radical
  );
}

function evaluateSurdCubic(
  coefficients: readonly Rational[],
  x: ExactSurd,
  D: Rational
): ExactSurd {
  let result: ExactSurd = {
    u: coefficients[0],
    v: Rat.zero
  };

  // Exact Horner evaluation inside Q(sqrt(D)).
  for (const coefficient of coefficients.slice(1)) {
    result = addSurds(
      multiplySurds(result, x, D),
      { u: coefficient, v: Rat.zero }
    );
  }

  return result;
}

interface ExactCubicCurvature {
  concaveUpIntervals: string[];
  concaveDownIntervals: string[];
  inflectionPoints: Array<{ x: string; y: string }>;
}

function proveIrrationalCubicRoots(
  coefficients: readonly Rational[],
  A: Rational,
  B: Rational,
  D: Rational,
  steps: MathStep[],
  curvature: ExactCubicCurvature
): CubicMonotonicityProof {
  const two = { num: 2n, den: 1n };
  const twoA = Rat.mul(two, A);

  const midpoint = Rat.div(negate(B), twoA);

  const absoluteA = {
    num: A.num < 0n ? -A.num : A.num,
    den: A.den
  };

  const radius = Rat.div(
    Rat.one,
    Rat.mul(two, absoluteA)
  );

  // D > 0 and radius > 0 imply exact root ordering.
  const left: ExactSurd = {
    u: midpoint,
    v: negate(radius)
  };

  const right: ExactSurd = {
    u: midpoint,
    v: radius
  };

  const x1 = showSurd(left, D);
  const x2 = showSurd(right, D);

  const y1 = showSurd(
    evaluateSurdCubic(coefficients, left, D),
    D
  );

  const y2 = showSurd(
    evaluateSurdCubic(coefficients, right, D),
    D
  );

  const increasingOutside = A.num > 0n;

  steps.push(
    {
      id: 'cubic_irrational_exact_roots',
      title: 'Determine the exact algebraic roots',
      explanation:
        `The discriminant ${show(D)} is positive. ` +
        `The ordered exact roots are x1 = ${x1} ` +
        `and x2 = ${x2}. No decimal approximation is used.`
    },
    {
      id: 'cubic_irrational_sign_proof',
      title: 'Prove the derivative sign on every interval',
      explanation:
        `f'(x) = (${show(A)})(x-x1)(x-x2), ` +
        `where x1 < x2. ` +
        (increasingOutside
          ? 'The derivative is positive outside the roots ' +
            'and negative between them.'
          : 'The derivative is negative outside the roots ' +
            'and positive between them.')
    },
    {
      id: 'cubic_irrational_exact_values',
      title: 'Determine exact local extremum values',
      explanation:
        `Exact substitution gives f(x1) = ${y1} ` +
        `and f(x2) = ${y2}. ` +
        'The derivative sign changes establish the ' +
        'local extrema, not global extrema.'
    }
  );

  return {
    status: 'verified',
    scope: 'rational_cubic_exact_sign_analysis',
    degree: 3,
    ...curvature,
    criticalPoints: [x1, x2],
    increasingIntervals: increasingOutside
      ? [
          between('-infinity', x1),
          between(x2, '+infinity')
        ]
      : [between(x1, x2)],
    decreasingIntervals: increasingOutside
      ? [between(x1, x2)]
      : [
          between('-infinity', x1),
          between(x2, '+infinity')
        ],
    extrema: [
      {
        type: increasingOutside
          ? 'local_maximum'
          : 'local_minimum',
        x: x1,
        y: y1
      },
      {
        type: increasingOutside
          ? 'local_minimum'
          : 'local_maximum',
        x: x2,
        y: y2
      }
    ],
    steps
  };
}

export function proveCubicMonotonicity(
  expression: string
): CubicMonotonicityProof {
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

  if (
    polynomialDegree(
      ast,
      { remaining: 150 }
    ) !== 3
  ) {
    return {
      status: 'unsupported',
      reason:
        'Exact cubic proof requires a polynomial of ' +
        'structural degree three with supported rational coefficients.'
    };
  }

  const series = new LocalSeriesEngine().expand(
    ast,
    'x',
    0,
    3
  );

  if (!series || series.terms.length !== 4) {
    return {
      status: 'unsupported',
      reason: 'Exact cubic coefficients could not be extracted.'
    };
  }

  const [d, c, b, a] = series.terms.map(
    term => Rat.simplify(term)
  );

  if (Rat.isZero(a)) {
    return {
      status: 'unsupported',
      reason:
        'The cubic coefficient vanishes after expansion; ' +
        'a lower-degree proof is required.'
    };
  }

  // f'(x) = A*x^2 + B*x + C.
  const A = Rat.mul({ num: 3n, den: 1n }, a);
  const B = Rat.mul({ num: 2n, den: 1n }, b);
  const C = c;

  const four = { num: 4n, den: 1n };
  const two = { num: 2n, den: 1n };

  const discriminant = Rat.sub(
    Rat.mul(B, B),
    Rat.mul(four, Rat.mul(A, C))
  );

  // f''(x) = 6ax + 2b, with a != 0.
  // Therefore its unique zero changes the concavity sign.
  const inflectionX = Rat.div(
    negate(b),
    Rat.mul({ num: 3n, den: 1n }, a)
  );

  const inflectionY = evaluateCubic(
    [a, b, c, d],
    inflectionX
  );

  const inflectionXText = show(inflectionX);
  const inflectionYText = show(inflectionY);
  const concaveUpToRight = a.num > 0n;

  const curvature: ExactCubicCurvature = {
    concaveUpIntervals: concaveUpToRight
      ? [between(inflectionXText, '+infinity')]
      : [between('-infinity', inflectionXText)],
    concaveDownIntervals: concaveUpToRight
      ? [between('-infinity', inflectionXText)]
      : [between(inflectionXText, '+infinity')],
    inflectionPoints: [{
      x: inflectionXText,
      y: inflectionYText
    }]
  };

  const steps: MathStep[] = [
    {
      id: 'cubic_exact_coefficients',
      title: 'Extract exact cubic coefficients',
      explanation:
        `f(x) = (${show(a)})x^3 + (${show(b)})x^2 + ` +
        `(${show(c)})x + (${show(d)}).`
    },
    {
      id: 'cubic_exact_derivative',
      title: 'Form the derivative quadratic',
      explanation:
        `f'(x) = (${show(A)})x^2 + (${show(B)})x + ` +
        `(${show(C)}). The exact discriminant is ` +
        `${show(discriminant)}.`
    },
    {
      id: 'cubic_exact_concavity',
      title: 'Prove concavity and inflection point',
      explanation:
        `f''(x) = (${show(Rat.mul(
          { num: 6n, den: 1n }, a
        ))})x + (${show(Rat.mul(
          { num: 2n, den: 1n }, b
        ))}). ` +
        `Its unique zero is x = ${inflectionXText}. ` +
        (concaveUpToRight
          ? 'The second derivative is negative to the left ' +
            'and positive to the right. '
          : 'The second derivative is positive to the left ' +
            'and negative to the right. ') +
        `The inflection point is ` +
        `(${inflectionXText}, ${inflectionYText}).`
    }
  ];

  if (discriminant.num < 0n) {
    const increasing = A.num > 0n;

    steps.push({
      id: 'cubic_negative_discriminant',
      title: 'Prove a constant derivative sign',
      explanation:
        'The derivative quadratic has negative discriminant. ' +
        `Since its leading coefficient is ${show(A)}, ` +
        `it is strictly ${increasing ? 'positive' : 'negative'} ` +
        'for every real x.'
    });

    return {
      status: 'verified',
      scope: 'rational_cubic_exact_sign_analysis',
      degree: 3,
      ...curvature,
      criticalPoints: [],
      increasingIntervals: increasing ? [fullLine()] : [],
      decreasingIntervals: increasing ? [] : [fullLine()],
      extrema: [],
      steps
    };
  }

  const negativeB = negate(B);
  const twoA = Rat.mul(two, A);

  if (Rat.isZero(discriminant)) {
    const repeatedRoot = Rat.div(
      negativeB,
      twoA
    );

    const x = show(repeatedRoot);
    const increasing = A.num > 0n;

    steps.push({
      id: 'cubic_repeated_stationary_root',
      title: 'Analyze a repeated stationary point',
      explanation:
        `f'(x) = (${show(A)})(x - (${x}))^2. ` +
        'The derivative vanishes only at this point and ' +
        `has ${increasing ? 'positive' : 'negative'} sign elsewhere. ` +
        'The cubic remains strictly monotone on the real line. ' +
        'The stationary point is not a local extremum.'
    });

    return {
      status: 'verified',
      scope: 'rational_cubic_exact_sign_analysis',
      degree: 3,
      ...curvature,
      criticalPoints: [x],
      increasingIntervals: increasing ? [fullLine()] : [],
      decreasingIntervals: increasing ? [] : [fullLine()],
      extrema: [],
      steps
    };
  }

  const rootDiscriminant =
    exactRationalSquareRoot(discriminant);

  if (!rootDiscriminant) {
    return proveIrrationalCubicRoots(
      [a, b, c, d],
      A,
      B,
      discriminant,
      steps,
      curvature
    );
  }

  const root1 = Rat.div(
    Rat.sub(negativeB, rootDiscriminant),
    twoA
  );

  const root2 = Rat.div(
    Rat.add(negativeB, rootDiscriminant),
    twoA
  );

  const left = compare(root1, root2) < 0
    ? root1
    : root2;

  const right = compare(root1, root2) < 0
    ? root2
    : root1;

  const leftText = show(left);
  const rightText = show(right);

  const leftValue = show(
    evaluateCubic([a, b, c, d], left)
  );

  const rightValue = show(
    evaluateCubic([a, b, c, d], right)
  );

  const increasingOutside = A.num > 0n;

  steps.push(
    {
      id: 'cubic_exact_stationary_roots',
      title: 'Find both exact stationary points',
      explanation:
        `Solving f'(x)=0 with the exact quadratic formula gives ` +
        `x = ${leftText} and x = ${rightText}.`
    },
    {
      id: 'cubic_exact_sign_intervals',
      title: 'Establish the derivative signs',
      explanation: increasingOutside
        ? 'The derivative is positive outside the two roots ' +
          'and negative between them.'
        : 'The derivative is negative outside the two roots ' +
          'and positive between them.'
    },
    {
      id: 'cubic_exact_local_extrema',
      title: 'Classify local extrema',
      explanation: increasingOutside
        ? `Local maximum at (${leftText}, ${leftValue}); ` +
          `local minimum at (${rightText}, ${rightValue}).`
        : `Local minimum at (${leftText}, ${leftValue}); ` +
          `local maximum at (${rightText}, ${rightValue}).`
    }
  );

  return {
    status: 'verified',
    scope: 'rational_cubic_exact_sign_analysis',
    degree: 3,
    ...curvature,
    criticalPoints: [leftText, rightText],
    increasingIntervals: increasingOutside
      ? [
          between('-infinity', leftText),
          between(rightText, '+infinity')
        ]
      : [between(leftText, rightText)],
    decreasingIntervals: increasingOutside
      ? [between(leftText, rightText)]
      : [
          between('-infinity', leftText),
          between(rightText, '+infinity')
        ],
    extrema: [
      {
        type: increasingOutside
          ? 'local_maximum'
          : 'local_minimum',
        x: leftText,
        y: leftValue
      },
      {
        type: increasingOutside
          ? 'local_minimum'
          : 'local_maximum',
        x: rightText,
        y: rightValue
      }
    ],
    steps
  };
}
