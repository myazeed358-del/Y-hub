import { FuzzyInterval, AlphaCutFamily, createInterval } from './alpha_cuts';
import { FuzzyNumber } from './numbers';
import { FuzzyArithmeticResult } from './types';

export function intervalAdd(i1: FuzzyInterval, i2: FuzzyInterval): FuzzyInterval {
  return createInterval(i1.lower + i2.lower, i1.upper + i2.upper);
}

export function intervalSub(i1: FuzzyInterval, i2: FuzzyInterval): FuzzyInterval {
  return createInterval(i1.lower - i2.upper, i1.upper - i2.lower);
}

export function intervalMul(i1: FuzzyInterval, i2: FuzzyInterval): FuzzyInterval {
  const p1 = i1.lower * i2.lower;
  const p2 = i1.lower * i2.upper;
  const p3 = i1.upper * i2.lower;
  const p4 = i1.upper * i2.upper;
  return createInterval(Math.min(p1, p2, p3, p4), Math.max(p1, p2, p3, p4));
}

export function intervalDiv(i1: FuzzyInterval, i2: FuzzyInterval): FuzzyInterval | 'invalid_domain' {
  if (i2.lower <= 0 && i2.upper >= 0) {
    return 'invalid_domain';
  }
  return intervalMul(i1, createInterval(1 / i2.upper, 1 / i2.lower));
}

export function scalarMul(i: FuzzyInterval, k: number): FuzzyInterval {
  const p1 = i.lower * k;
  const p2 = i.upper * k;
  return createInterval(Math.min(p1, p2), Math.max(p1, p2));
}

export type ArithmeticOperation = 'add' | 'sub' | 'mul' | 'div';

export function fuzzyArithmetic(
  f1: FuzzyNumber, 
  f2: FuzzyNumber, 
  operation: ArithmeticOperation,
  alphaResolution: number = 11
): Omit<FuzzyArithmeticResult, keyof import('./types').FuzzyResult> {
  const cuts = [];
  const step = 1.0 / (alphaResolution - 1);

  let status: 'success' | 'invalid_domain' = 'success';

  for (let i = 0; i < alphaResolution; i++) {
    const alpha = i === alphaResolution - 1 ? 1.0 : i * step;
    
    const cut1 = f1.getAlphaCut(alpha);
    const cut2 = f2.getAlphaCut(alpha);
    
    let resultInterval: FuzzyInterval | 'invalid_domain';
    switch (operation) {
      case 'add':
        resultInterval = intervalAdd(cut1.interval, cut2.interval);
        break;
      case 'sub':
        resultInterval = intervalSub(cut1.interval, cut2.interval);
        break;
      case 'mul':
        resultInterval = intervalMul(cut1.interval, cut2.interval);
        break;
      case 'div':
        resultInterval = intervalDiv(cut1.interval, cut2.interval);
        break;
      default:
        throw new Error('Unsupported operation');
    }
    
    if (resultInterval === 'invalid_domain') {
      status = 'invalid_domain';
      break;
    }
    
    cuts.push({
      alpha,
      interval: resultInterval,
      isStrong: false
    });
  }
  
  return {
    operation,
    alphaResolution,
    cuts: status === 'success' ? cuts : [],
    mathematicalExactness: 'exact',
    representationAccuracy: 'sampled',
    status
  };
}
