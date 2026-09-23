export type MembershipFunctionType = 'triangle' | 'trapezoid' | 'gaussian';

export type MembershipParameters = {
  a: number;
  b: number;
  c: number;
  d: number;
  center: number;
  spread: number;
};

export type FuzzySet = {
  name: string;
  membership: (x: number) => number;
};

export function clampMembership(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function triangularMembership(x: number, a: number, b: number, c: number) {
  if (a === b && x === b) return 1;
  if (b === c && x === b) return 1;
  if (x <= a || x >= c) return 0;
  return clampMembership(x <= b ? (x - a) / (b - a) : (c - x) / (c - b));
}

export function trapezoidalMembership(x: number, a: number, b: number, c: number, d: number) {
  if (x <= a || x >= d) return 0;
  if (x < b) return clampMembership((x - a) / (b - a));
  if (x <= c) return 1;
  return clampMembership((d - x) / (d - c));
}

export function gaussianMembership(x: number, center: number, spread: number) {
  const safeSpread = Math.max(spread, Number.EPSILON);
  return clampMembership(Math.exp(-0.5 * Math.pow((x - center) / safeSpread, 2)));
}

export function membershipValue(type: MembershipFunctionType, x: number, params: MembershipParameters) {
  if (type === 'triangle') return triangularMembership(x, params.a, params.b, params.c);
  if (type === 'trapezoid') return trapezoidalMembership(x, params.a, params.b, params.c, params.d);
  return gaussianMembership(x, params.center, params.spread);
}

export function sampleMembershipCurve(
  type: MembershipFunctionType,
  params: MembershipParameters,
  count = 101,
) {
  return Array.from({ length: count }, (_, index) => {
    const x = (index / Math.max(count - 1, 1)) * 100;
    return { x, y: membershipValue(type, x, params) };
  });
}

export function fuzzyUnion(left: number, right: number) {
  return Math.max(left, right);
}

export function fuzzyIntersection(left: number, right: number) {
  return Math.min(left, right);
}

export function fuzzyComplement(value: number) {
  return 1 - clampMembership(value);
}

export function alphaCut(values: Record<string, number>, alpha: number) {
  return Object.entries(values)
    .filter(([, value]) => value >= alpha)
    .map(([label]) => label);
}

export function composeRelation(
  left: number[][],
  right: number[][],
) {
  if (!left.length || !right.length || left[0].length !== right.length) {
    throw new Error('Relation dimensions must align for max-min composition.');
  }
  return left.map((row) =>
    right[0].map((_, column) =>
      Math.max(...right.map((rightRow, index) => Math.min(row[index], rightRow[column]))),
    ),
  );
}

export function centroidDefuzzify(points: Array<{ value: number; membership: number }>) {
  const denominator = points.reduce((sum, point) => sum + point.membership, 0);
  if (!denominator) return 0;
  return points.reduce((sum, point) => sum + point.value * point.membership, 0) / denominator;
}

// Fuzzy T-norms
export function tNormStandard(a: number, b: number) {
  return Math.min(a, b);
}

export function tNormAlgebraic(a: number, b: number) {
  return a * b;
}

export function tNormBounded(a: number, b: number) {
  return Math.max(0, a + b - 1);
}

export function tNormDrastic(a: number, b: number) {
  if (b === 1) return a;
  if (a === 1) return b;
  return 0;
}