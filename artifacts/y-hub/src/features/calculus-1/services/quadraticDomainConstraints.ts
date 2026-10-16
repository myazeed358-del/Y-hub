import { ExpressionParser } from '@/services/math/parser';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { Endpoint, Interval } from '@/services/math/types/set';

export interface QuadraticDomainPolynomial {
  a: Rational;
  b: Rational;
  c: Rational;
}

export type QuadraticDomainRelation =
  'nonzero' | 'positive' | 'nonnegative';

type Coefficients = [Rational, Rational, Rational];

function number(value: string): Rational | null {
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

function isZero(value: Rational): boolean {
  return Rat.isZero(value);
}

function add(
  left: Coefficients,
  right: Coefficients
): Coefficients {
  return [
    Rat.add(left[0], right[0]),
    Rat.add(left[1], right[1]),
    Rat.add(left[2], right[2])
  ];
}

function negate(value: Coefficients): Coefficients {
  const minusOne = { num: -1n, den: 1n };

  return [
    Rat.mul(value[0], minusOne),
    Rat.mul(value[1], minusOne),
    Rat.mul(value[2], minusOne)
  ];
}

function multiply(
  left: Coefficients,
  right: Coefficients
): Coefficients | null {
  const result: Coefficients = [
    Rat.zero, Rat.zero, Rat.zero
  ];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (isZero(left[i]) || isZero(right[j])) {
        continue;
      }

      if (i + j > 2) return null;

      result[i + j] = Rat.add(
        result[i + j],
        Rat.mul(left[i], right[j])
      );
    }
  }

  return result;
}

function extract(
  node: CanonicalAST,
  budget: { remaining: number }
): Coefficients | null {
  budget.remaining--;

  if (budget.remaining < 0) return null;

  if (node.type === 'Parenthesis') {
    return extract(node.content, budget);
  }

  if (node.type === 'Number') {
    const value = number(node.value);
    return value
      ? [value, Rat.zero, Rat.zero]
      : null;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x'
      ? [Rat.zero, Rat.one, Rat.zero]
      : null;
  }

  if (node.type !== 'Operator') return null;

  const args = node.args;

  if (node.operator === '+' || node.operator === '-') {
    if (
      !args.length ||
      (node.operator === '-' && args.length > 2)
    ) return null;

    const first = extract(args[0], budget);
    if (!first) return null;

    if (node.operator === '-' && args.length === 1) {
      return negate(first);
    }

    let result = first;

    for (let i = 1; i < args.length; i++) {
      const next = extract(args[i], budget);
      if (!next) return null;

      result = add(
        result,
        node.operator === '-' ? negate(next) : next
      );
    }

    return result;
  }

  if (
    node.operator === '*' ||
    node.operator === 'implicit_multiply'
  ) {
    if (!args.length) return null;

    let result: Coefficients = [
      Rat.one, Rat.zero, Rat.zero
    ];

    for (const arg of args) {
      const next = extract(arg, budget);
      if (!next) return null;

      const product = multiply(result, next);
      if (!product) return null;

      result = product;
    }

    return result;
  }

  if (node.operator === '/') {
    if (args.length !== 2) return null;

    const numerator = extract(args[0], budget);
    const denominator = extract(args[1], budget);

    if (
      !numerator ||
      !denominator ||
      !isZero(denominator[1]) ||
      !isZero(denominator[2]) ||
      isZero(denominator[0])
    ) {
      return null;
    }

    return [
      Rat.div(numerator[0], denominator[0]),
      Rat.div(numerator[1], denominator[0]),
      Rat.div(numerator[2], denominator[0])
    ];
  }

  if (node.operator === '^') {
    if (
      args.length !== 2 ||
      args[1].type !== 'Number' ||
      !/^[012]$/.test(args[1].value)
    ) {
      return null;
    }

    const base = extract(args[0], budget);
    if (!base) return null;

    const power = Number(args[1].value);

    if (power === 0) {
      return [Rat.one, Rat.zero, Rat.zero];
    }

    if (power === 1) return base;
    return multiply(base, base);
  }

  return null;
}

export function extractQuadraticDomainPolynomial(
  ast: CanonicalAST
): QuadraticDomainPolynomial | null {
  const result = extract(ast, { remaining: 150 });
  if (!result) return null;

  return {
    a: result[2],
    b: result[1],
    c: result[0]
  };
}

function show(value: Rational): string {
  const simplified = Rat.simplify(value);

  return simplified.den === 1n
    ? String(simplified.num)
    : `${simplified.num}/${simplified.den}`;
}

function point(value: Rational): Endpoint {
  const rational = Rat.simplify(value);

  return {
    type: 'value',
    ast: { type: 'Number', value: show(rational) },
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

function interval(
  left: Endpoint,
  right: Endpoint,
  leftClosed = false,
  rightClosed = false
): Interval {
  return { left, right, leftClosed, rightClosed };
}

function realLine(): Interval[] {
  return [interval(negativeInfinity, positiveInfinity)];
}

function except(root: Endpoint): Interval[] {
  return [
    interval(negativeInfinity, root),
    interval(root, positiveInfinity)
  ];
}

function sign(value: Rational): number {
  return value.num < 0n ? -1 : value.num > 0n ? 1 : 0;
}

function compare(left: Rational, right: Rational): number {
  const difference = Rat.sub(left, right);
  return sign(difference);
}

function integerSquareRoot(value: bigint): bigint | null {
  if (value < 0n) return null;
  if (value < 2n) return value;

  let current =
    1n << BigInt(Math.ceil(value.toString(2).length / 2));

  while (true) {
    const next = (current + value / current) / 2n;

    if (next >= current) {
      return current * current === value
        ? current
        : null;
    }

    current = next;
  }
}

function exactSquareRoot(value: Rational): Rational | null {
  const rational = Rat.simplify(value);
  if (rational.num < 0n) return null;

  const numerator = integerSquareRoot(rational.num);
  const denominator = integerSquareRoot(rational.den);

  if (numerator === null || denominator === null) {
    return null;
  }

  return Rat.simplify({
    num: numerator,
    den: denominator
  });
}


// The two roots are m +/- sqrt(q), with q > 0 nonsquare.
// Both isolating intervals are rational and certified.
function irrationalQuadratic(
  coefficients: QuadraticDomainPolynomial,
  discriminant: Rational,
  relation: QuadraticDomainRelation
): Interval[] {
  const { a, b, c } = coefficients;

  const two = { num: 2n, den: 1n };
  const four = { num: 4n, den: 1n };
  const minusOne = { num: -1n, den: 1n };

  const m = Rat.div(
    Rat.mul(b, minusOne),
    Rat.mul(two, a)
  );

  const q = Rat.div(
    discriminant,
    Rat.mul(four, Rat.mul(a, a))
  );

  // q is strictly positive. This power of two is
  // strictly greater than sqrt(q), without floats.
  const k = 1n << BigInt(
    Math.ceil(q.num.toString(2).length / 2)
  );

  const bound = { num: k, den: 1n };

  const parser = new ExpressionParser();

  const metadata = {
    degree: 2,
    polyCoeffsRat: [c, b, a]
  };

  const left: Endpoint = {
    type: 'value',
    ast: parser.parse(
      `(${show(m)})-sqrt(${show(q)})`
    ),
    algebraic: {
      ...metadata,
      ast: parser.parse(
        `(${show(m)})-sqrt(${show(q)})`
      ),
      isolatingInterval: {
        left: Rat.sub(m, bound),
        right: m
      }
    }
  };

  const right: Endpoint = {
    type: 'value',
    ast: parser.parse(
      `(${show(m)})+sqrt(${show(q)})`
    ),
    algebraic: {
      ...metadata,
      ast: parser.parse(
        `(${show(m)})+sqrt(${show(q)})`
      ),
      isolatingInterval: {
        left: m,
        right: Rat.add(m, bound)
      }
    }
  };

  if (relation === 'nonzero') {
    return [
      interval(negativeInfinity, left),
      interval(left, right),
      interval(right, positiveInfinity)
    ];
  }

  const closed = relation === 'nonnegative';

  return sign(a) > 0
    ? [
        interval(negativeInfinity, left, false, closed),
        interval(right, positiveInfinity, closed)
      ]
    : [
        interval(left, right, closed, closed)
      ];
}

function linear(
  b: Rational,
  c: Rational,
  relation: QuadraticDomainRelation
): Interval[] {
  if (isZero(b)) {
    const valid = relation === 'nonzero'
      ? !isZero(c)
      : relation === 'positive'
        ? sign(c) > 0
        : sign(c) >= 0;

    return valid ? realLine() : [];
  }

  const root = point(
    Rat.div(Rat.mul(c, { num: -1n, den: 1n }), b)
  );

  if (relation === 'nonzero') return except(root);

  const closed = relation === 'nonnegative';

  return sign(b) > 0
    ? [interval(root, positiveInfinity, closed)]
    : [interval(negativeInfinity, root, false, closed)];
}

export function solveQuadraticDomainConstraint(
  coefficients: QuadraticDomainPolynomial,
  relation: QuadraticDomainRelation
): Interval[] | null {
  const { a, b, c } = coefficients;

  if (isZero(a)) return linear(b, c, relation);

  const four = { num: 4n, den: 1n };
  const two = { num: 2n, den: 1n };

  const discriminant = Rat.sub(
    Rat.mul(b, b),
    Rat.mul(four, Rat.mul(a, c))
  );

  if (sign(discriminant) < 0) {
    return relation === 'nonzero' || sign(a) > 0
      ? realLine()
      : [];
  }

  if (isZero(discriminant)) {
    const root = point(
      Rat.div(
        Rat.mul(b, { num: -1n, den: 1n }),
        Rat.mul(two, a)
      )
    );

    if (relation === 'nonzero') return except(root);

    if (sign(a) > 0) {
      return relation === 'nonnegative'
        ? realLine()
        : except(root);
    }

    return relation === 'nonnegative'
      ? [interval(root, root, true, true)]
      : [];
  }

  const sqrtDiscriminant = exactSquareRoot(discriminant);

  if (!sqrtDiscriminant) {
    return irrationalQuadratic(
      coefficients,
      discriminant,
      relation
    );
  }

  const negativeB = Rat.mul(
    b, { num: -1n, den: 1n }
  );
  const denominator = Rat.mul(two, a);

  const root1 = Rat.div(
    Rat.sub(negativeB, sqrtDiscriminant),
    denominator
  );

  const root2 = Rat.div(
    Rat.add(negativeB, sqrtDiscriminant),
    denominator
  );

  const left = point(
    compare(root1, root2) <= 0 ? root1 : root2
  );

  const right = point(
    compare(root1, root2) <= 0 ? root2 : root1
  );

  if (relation === 'nonzero') {
    return [
      interval(negativeInfinity, left),
      interval(left, right),
      interval(right, positiveInfinity)
    ];
  }

  const closed = relation === 'nonnegative';

  if (sign(a) > 0) {
    return [
      interval(negativeInfinity, left, false, closed),
      interval(right, positiveInfinity, closed)
    ];
  }

  return [interval(left, right, closed, closed)];
}
