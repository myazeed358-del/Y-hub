import { MembershipFunction, MembershipFunctionType } from './types';

export class TriangularMembership implements MembershipFunction {
  type: MembershipFunctionType = 'triangle';
  constructor(public params: { a: number; b: number; c: number }) {}
  evaluate(x: number): number {
    const { a, b, c } = this.params;
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
  }
}

export class TrapezoidalMembership implements MembershipFunction {
  type: MembershipFunctionType = 'trapezoid';
  constructor(public params: { a: number; b: number; c: number; d: number }) {}
  evaluate(x: number): number {
    const { a, b, c, d } = this.params;
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
  }
}

export class GaussianMembership implements MembershipFunction {
  type: MembershipFunctionType = 'gaussian';
  constructor(public params: { center: number; sigma: number }) {}
  evaluate(x: number): number {
    const { center, sigma } = this.params;
    if (sigma === 0) return x === center ? 1 : 0;
    return Math.exp(-0.5 * Math.pow((x - center) / sigma, 2));
  }
}
