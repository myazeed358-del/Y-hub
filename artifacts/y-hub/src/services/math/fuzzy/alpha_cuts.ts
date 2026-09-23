export interface FuzzyInterval {
  lower: number;
  upper: number;
}

export interface AlphaCut {
  alpha: number;
  interval: FuzzyInterval;
  isStrong: boolean;
}

export interface AlphaCutFamily {
  cuts: AlphaCut[];
  isExact: boolean;
}

export function createInterval(lower: number, upper: number): FuzzyInterval {
  if (lower > upper) {
    throw new Error('Invalid interval: lower bound cannot be greater than upper bound.');
  }
  return { lower, upper };
}
