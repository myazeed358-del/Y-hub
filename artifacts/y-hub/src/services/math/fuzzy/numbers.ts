import { FuzzyInterval, AlphaCut, createInterval } from './alpha_cuts';

export abstract class FuzzyNumber {
  abstract evaluate(x: number): number;
  abstract getSupport(): FuzzyInterval;
  abstract getCore(): FuzzyInterval;
  abstract getAlphaCut(alpha: number): AlphaCut;
  abstract getStrongAlphaCut(alpha: number): AlphaCut;
  
  getHeight(): number {
    return 1; // Assuming normalized by default, overridden if not.
  }
  
  isNormal(): boolean {
    return this.getHeight() === 1;
  }
  
  isConvex(): boolean {
    return true; // TFN and TrFN are strictly convex.
  }
}

export class TriangularFuzzyNumber extends FuzzyNumber {
  constructor(public a: number, public b: number, public c: number) {
    super();
    if (a > b || b > c) {
      throw new Error('Invalid TFN parameters: must satisfy a <= b <= c');
    }
  }

  evaluate(x: number): number {
    if (x <= this.a || x >= this.c) return 0;
    if (x === this.b) return 1;
    if (this.a === this.b && x === this.a) return 1;
    if (this.b === this.c && x === this.c) return 1;
    return x < this.b ? (x - this.a) / (this.b - this.a) : (this.c - x) / (this.c - this.b);
  }

  getSupport(): FuzzyInterval {
    return createInterval(this.a, this.c);
  }

  getCore(): FuzzyInterval {
    return createInterval(this.b, this.b);
  }

  getAlphaCut(alpha: number): AlphaCut {
    if (alpha <= 0 || alpha > 1) {
      if (alpha === 0) return { alpha, interval: this.getSupport(), isStrong: false };
      throw new Error('Alpha must be in (0, 1]');
    }
    const lower = this.a + alpha * (this.b - this.a);
    const upper = this.c - alpha * (this.c - this.b);
    return { alpha, interval: createInterval(lower, upper), isStrong: false };
  }

  getStrongAlphaCut(alpha: number): AlphaCut {
    if (alpha < 0 || alpha >= 1) {
      throw new Error('Strong Alpha must be in [0, 1)');
    }
    // Strong alpha cut is mathematically an open interval (lower, upper).
    // We store the bounds, but semantically mark it as strong.
    const lower = this.a + alpha * (this.b - this.a);
    const upper = this.c - alpha * (this.c - this.b);
    return { alpha, interval: createInterval(lower, upper), isStrong: true };
  }
}

export class TrapezoidalFuzzyNumber extends FuzzyNumber {
  constructor(public a: number, public b: number, public c: number, public d: number) {
    super();
    if (a > b || b > c || c > d) {
      throw new Error('Invalid TrFN parameters: must satisfy a <= b <= c <= d');
    }
  }

  evaluate(x: number): number {
    if (x <= this.a || x >= this.d) return 0;
    if (x >= this.b && x <= this.c) return 1;
    return x < this.b ? (x - this.a) / (this.b - this.a) : (this.d - x) / (this.d - this.c);
  }

  getSupport(): FuzzyInterval {
    return createInterval(this.a, this.d);
  }

  getCore(): FuzzyInterval {
    return createInterval(this.b, this.c);
  }

  getAlphaCut(alpha: number): AlphaCut {
    if (alpha <= 0 || alpha > 1) {
      if (alpha === 0) return { alpha, interval: this.getSupport(), isStrong: false };
      throw new Error('Alpha must be in (0, 1]');
    }
    const lower = this.a + alpha * (this.b - this.a);
    const upper = this.d - alpha * (this.d - this.c);
    return { alpha, interval: createInterval(lower, upper), isStrong: false };
  }

  getStrongAlphaCut(alpha: number): AlphaCut {
    if (alpha < 0 || alpha >= 1) {
      throw new Error('Strong Alpha must be in [0, 1)');
    }
    const lower = this.a + alpha * (this.b - this.a);
    const upper = this.d - alpha * (this.d - this.c);
    return { alpha, interval: createInterval(lower, upper), isStrong: true };
  }
}
