export interface Rational {
  num: bigint;
  den: bigint;
}

export class Rat {
  public static readonly zero: Rational = { num: 0n, den: 1n };
  public static readonly one: Rational = { num: 1n, den: 1n };
  public static readonly minusOne: Rational = { num: -1n, den: 1n };

  public static gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  public static simplify(r: Rational): Rational {
    if (r.num === 0n) return { num: 0n, den: 1n };
    const g = Rat.gcd(r.num, r.den);
    let n = r.num / g;
    let d = r.den / g;
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    return { num: n, den: d };
  }

  public static add(a: Rational, b: Rational): Rational {
    return Rat.simplify({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
  }

  public static sub(a: Rational, b: Rational): Rational {
    return Rat.simplify({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
  }

  public static mul(a: Rational, b: Rational): Rational {
    return Rat.simplify({ num: a.num * b.num, den: a.den * b.den });
  }

  public static div(a: Rational, b: Rational): Rational {
    if (b.num === 0n) throw new Error("Division by zero");
    return Rat.simplify({ num: a.num * b.den, den: a.den * b.num });
  }

  public static fromString(s: string): Rational {
    if (s.includes('e') || s.includes('E')) throw new Error("Scientific notation not supported in exact rational");
    if (!s.includes('.')) return { num: BigInt(s), den: 1n };
    const [intPart, decPart] = s.split('.');
    const den = 10n ** BigInt(decPart.length);
    const numStr = intPart === '-' ? '-' + decPart : intPart + decPart;
    const num = BigInt(numStr);
    return Rat.simplify({ num, den });
  }

  public static fromNumber(n: number): Rational {
    return Rat.fromString(n.toString());
  }

  public static toString(r: Rational): string {
    const simplified = Rat.simplify(r);

    if (simplified.den === 1n) {
      return simplified.num.toString();
    }

    return `${simplified.num.toString()}/${simplified.den.toString()}`;
  }

  public static toNumber(r: Rational): number {
    return Number(r.num) / Number(r.den);
  }

  public static sign(r: Rational): -1 | 0 | 1 {
    const simplified = Rat.simplify(r);
    if (simplified.num === 0n) return 0;
    return simplified.num < 0n ? -1 : 1;
  }

  public static isZero(r: Rational): boolean {
    return r.num === 0n;
  }

  public static equals(a: Rational, b: Rational): boolean {
    const as = Rat.simplify(a);
    const bs = Rat.simplify(b);
    return as.num === bs.num && as.den === bs.den;
  }
}
