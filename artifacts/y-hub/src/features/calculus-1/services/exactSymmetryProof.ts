import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { MathStep } from '@/services/math/types/step';
import {
  extractQuadraticDomainPolynomial
} from './quadraticDomainConstraints';

export type ExactSymmetryProof =
  | {
      status: 'verified';
      scope: 'real_polynomials_degree_0_to_2';
      symmetry: 'even' | 'odd' | 'both' | 'neither';
      even: boolean;
      odd: boolean;
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

export function proveExactSymmetry(
  expression: string
): ExactSymmetryProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A mathematical expression is required.'
    };
  }

  try {
    const ast = new ASTNormalizer().normalize(
      new ExpressionParser().parse(expression)
    );

    const coefficients =
      extractQuadraticDomainPolynomial(ast);

    if (!coefficients) {
      return {
        status: 'unsupported',
        reason:
          'Complete symmetry proof currently supports ' +
          'real polynomials of degree at most two.'
      };
    }

    const { a, b, c } = coefficients;

    // f(x)  = ax^2 + bx + c
    // f(-x) = ax^2 - bx + c
    //
    // f(-x) - f(x) = -2bx.
    // Even iff b = 0.
    //
    // f(-x) + f(x) = 2ax^2 + 2c.
    // Odd iff a = 0 and c = 0.
    //
    // These polynomial identities hold for all real x.
    // Every polynomial has domain R, so the domain is
    // invariant under x -> -x.

    const even = Rat.isZero(b);
    const odd = Rat.isZero(a) && Rat.isZero(c);

    const symmetry = even && odd
      ? 'both'
      : even
        ? 'even'
        : odd
          ? 'odd'
          : 'neither';

    const steps: MathStep[] = [
      {
        id: 'symmetry_extract_coefficients',
        title: 'Identify the polynomial coefficients',
        explanation:
          `The exact polynomial is ` +
          `f(x) = (${show(a)})x^2 + ` +
          `(${show(b)})x + (${show(c)}).`
      },
      {
        id: 'symmetry_domain',
        title: 'Check domain symmetry',
        explanation:
          'Every real polynomial is defined on all real ' +
          'numbers, so its domain is invariant under ' +
          'replacing x with -x.'
      },
      {
        id: 'symmetry_even_identity',
        title: 'Test even symmetry exactly',
        explanation:
          'The polynomial identity ' +
          'f(-x) - f(x) = -2bx holds for every real x. ' +
          (even
            ? 'Because b = 0, the function is even.'
            : `Because b = ${show(b)} is nonzero, ` +
              'the function is not even.')
      },
      {
        id: 'symmetry_odd_identity',
        title: 'Test odd symmetry exactly',
        explanation:
          'The polynomial identity ' +
          'f(-x) + f(x) = 2ax^2 + 2c holds for every real x. ' +
          (odd
            ? 'Because a = 0 and c = 0, the function is odd.'
            : 'Since a and c are not both zero, ' +
              'the function is not odd.')
      },
      {
        id: 'symmetry_conclusion',
        title: 'State the verified symmetry',
        explanation:
          symmetry === 'both'
            ? 'The zero function is both even and odd.'
            : symmetry === 'even'
              ? 'The graph is symmetric about the y-axis.'
              : symmetry === 'odd'
                ? 'The graph is symmetric about the origin.'
                : 'The function is neither even nor odd.'
      }
    ];

    return {
      status: 'verified',
      scope: 'real_polynomials_degree_0_to_2',
      symmetry,
      even,
      odd,
      steps
    };
  } catch {
    return {
      status: 'unsupported',
      reason:
        'The expression could not be parsed or ' +
        'certified within the supported scope.'
    };
  }
}
