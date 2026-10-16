import { describe, expect, it } from 'vitest';
import { proveExactIntercepts } from '../services/exactInterceptProof';

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a === 0n ? 1n : a;
}

function fraction(n: number, d: number): string {
  let numerator = BigInt(n);
  let denominator = BigInt(d);

  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }

  const divisor = gcd(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;

  return denominator === 1n
    ? String(numerator)
    : `${numerator}/${denominator}`;
}

// Independent reference implementation for small
// integer coefficients. It does not call the engine's
// polynomial extractor or rational arithmetic.
function expectedRoots(a: number, b: number, c: number):
  | { kind: 'finite'; roots: string[] }
  | { kind: 'all_real' }
  | 'irrational' {
  if (a === 0 && b === 0) {
    return c === 0
      ? { kind: 'all_real' }
      : { kind: 'finite', roots: [] };
  }

  if (a === 0) {
    return {
      kind: 'finite',
      roots: [fraction(-c, b)]
    };
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return { kind: 'finite', roots: [] };
  }

  const squareRoot = Math.sqrt(discriminant);

  if (!Number.isInteger(squareRoot)) {
    return 'irrational';
  }

  const first = -b - squareRoot;
  const second = -b + squareRoot;

  const roots = [
    fraction(first, 2 * a),
    fraction(second, 2 * a)
  ];

  return {
    kind: 'finite',
    roots: [...new Set(roots)].sort(
      (left, right) => {
        const number = (s: string): number => {
          const [n, d = '1'] = s.split('/');
          return Number(n) / Number(d);
        };

        return number(left) - number(right);
      }
    )
  };
}

function verifyRoot(
  a: number, b: number, c: number, text: string
): void {
  const match = /^(-?\d+)(?:\/([1-9]\d*))?$/.exec(text);
  expect(match, `Invalid rational root: ${text}`).not.toBeNull();
  if (!match) return;

  const p = BigInt(match[1]);
  const q = BigInt(match[2] ?? '1');

  const residual =
    BigInt(a) * p * p +
    BigInt(b) * p * q +
    BigInt(c) * q * q;

  expect(
    residual,
    `Root ${text} does not satisfy the polynomial`
  ).toBe(0n);
}

describe('Independent intercept certification hardening', () => {
  it('checks all 343 small integer coefficient triples', () => {
    let checked = 0;

    for (let a = -3; a <= 3; a++) {
      for (let b = -3; b <= 3; b++) {
        for (let c = -3; c <= 3; c++) {
          const expression =
            `(${a})*x^2+(${b})*x+(${c})`;

          const expected = expectedRoots(a, b, c);
          const result = proveExactIntercepts(expression);

          if (expected === 'irrational') {
            expect(
              result.status,
              `Missing irrational proof for ${expression}`
            ).toBe('verified');

            if (result.status === 'verified') {
              const discriminant = b * b - 4 * a * c;
              const m = fraction(-b, 2 * a);
              const q = fraction(
                discriminant,
                4 * a * a
              );

              const radical = `sqrt(${q})`;

              const left = m === '0'
                ? `-${radical}`
                : `${m}-${radical}`;

              const right = m === '0'
                ? radical
                : `${m}+${radical}`;

              expect(result.yIntercept).toEqual({
                x: '0',
                y: String(c)
              });

              expect(result.xIntercepts).toEqual({
                kind: 'finite',
                roots: [left, right]
              });
            }
          } else {
            expect(
              result.status,
              `Expected proof for ${expression}`
            ).toBe('verified');

            if (result.status !== 'verified') continue;

            expect(result.yIntercept).toEqual({
              x: '0',
              y: String(c)
            });

            expect(result.xIntercepts).toEqual(expected);

            if (result.xIntercepts.kind === 'finite') {
              for (const root of result.xIntercepts.roots) {
                verifyRoot(a, b, c, root);
              }
            }
          }

          checked++;
        }
      }
    }

    expect(checked).toBe(343);
  });

  it.each([
    'x^3-1',
    'x^4-1',
    'sqrt(x)',
    '(x^2-1)/(x-1)'
  ])('refuses incomplete certification: %s', expression => {
    expect(proveExactIntercepts(expression).status)
      .toBe('unsupported');
  });

  it.each([
    ['x^2-1/4', ['-1/2', '1/2']],
    ['0.5*x^2-2', ['-2', '2']],
    ['x^2-0.25', ['-1/2', '1/2']],
    ['(x-1/2)^2', ['1/2']],
    ['2*x^2-3*x+1', ['1/2', '1']]
  ])('checks exact fractional roots: %s', (
    expression, expected
  ) => {
    const result = proveExactIntercepts(expression);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.xIntercepts).toEqual({
      kind: 'finite',
      roots: expected
    });
  });
});
