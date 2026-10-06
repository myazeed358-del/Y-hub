import { Endpoint, Interval, SolutionSet } from '../types/set';
import { ASTUtils } from './utils';
import { Rat } from './series';

export class SetEngine {

  public static createRealLine(variable: string = 'x'): SolutionSet {
    return {
      type: 'SolutionSet',
      variable,
      domainRestrictions: [],
      intervals: [
        {
          left: { type: 'infinity', sign: -1 },
          right: { type: 'infinity', sign: 1 },
          leftClosed: false,
          rightClosed: false
        }
      ]
    };
  }
  
  public static exactCompare(a: Endpoint, b: Endpoint): -1 | 0 | 1 | null {
    if (a.type === 'infinity' && b.type === 'infinity') {
      if (a.sign === b.sign) return 0;
      return a.sign < b.sign ? -1 : 1;
    }
    if (a.type === 'infinity') return a.sign === 1 ? 1 : -1;
    if (b.type === 'infinity') return b.sign === 1 ? -1 : 1;

    if (a.rational && b.rational) {
      const diff = a.rational.num * b.rational.den - b.rational.num * a.rational.den;
      // Denominators are always positive in our Rational representation
      if (diff === 0n) return 0;
      return diff > 0n ? 1 : -1;
    }

    if (ASTUtils.structuralEquals(a.ast, b.ast)) return 0;

    if (a.algebraic && b.algebraic) {
      const compareRat = (
        x: { num: bigint; den: bigint },
        y: { num: bigint; den: bigint }
      ): -1 | 0 | 1 => {
        const diff = x.num * y.den - y.num * x.den;
        if (diff === 0n) return 0;
        return diff < 0n ? -1 : 1;
      };

      const signRat = (
        x: { num: bigint; den: bigint }
      ): -1 | 0 | 1 => {
        if (x.num === 0n) return 0;
        return x.num < 0n ? -1 : 1;
      };

      const midpoint = (
        left: { num: bigint; den: bigint },
        right: { num: bigint; den: bigint }
      ) => Rat.div(
        Rat.add(left, right),
        { num: 2n, den: 1n }
      );

      const evalPoly = (
        coeffs: { num: bigint; den: bigint }[],
        x: { num: bigint; den: bigint }
      ) => {
        let sum = Rat.zero;
        let power = Rat.one;

        for (const coeff of coeffs) {
          sum = Rat.add(sum, Rat.mul(coeff, power));
          power = Rat.mul(power, x);
        }

        return sum;
      };

      const refine = (
        left: { num: bigint; den: bigint },
        right: { num: bigint; den: bigint },
        coeffs: { num: bigint; den: bigint }[]
      ): {
        left: { num: bigint; den: bigint };
        right: { num: bigint; den: bigint };
      } | null => {
        const fLeft = evalPoly(coeffs, left);
        const fRight = evalPoly(coeffs, right);

        if (signRat(fLeft) === 0) {
          return { left, right: left };
        }

        if (signRat(fRight) === 0) {
          return { left: right, right };
        }

        const mid = midpoint(left, right);
        const fMid = evalPoly(coeffs, mid);

        if (signRat(fMid) === 0) {
          return { left: mid, right: mid };
        }

        if (signRat(fLeft) !== signRat(fMid)) {
          return { left, right: mid };
        }

        if (signRat(fMid) !== signRat(fRight)) {
          return { left: mid, right };
        }

        return null;
      };

      let aLeft = a.algebraic.isolatingInterval.left;
      let aRight = a.algebraic.isolatingInterval.right;
      let bLeft = b.algebraic.isolatingInterval.left;
      let bRight = b.algebraic.isolatingInterval.right;

      for (let i = 0; i < 96; i++) {
        if (compareRat(aRight, bLeft) < 0) return -1;
        if (compareRat(bRight, aLeft) < 0) return 1;

        const nextA = refine(
          aLeft,
          aRight,
          a.algebraic.polyCoeffsRat
        );

        const nextB = refine(
          bLeft,
          bRight,
          b.algebraic.polyCoeffsRat
        );

        if (!nextA || !nextB) {
          break;
        }

        aLeft = nextA.left;
        aRight = nextA.right;
        bLeft = nextB.left;
        bRight = nextB.right;
      }
    }
    
    // Fallback: cannot exactly determine ordering symbolically
    return null;
  }

  public static normalizeUnion(intervals: Interval[]): Interval[] {
    if (intervals.length <= 1) return intervals;
    
    // Sort intervals by left endpoint
    const sorted = [...intervals].sort((a, b) => {
      const cmp = this.exactCompare(a.left, b.left);
      if (cmp !== null && cmp !== 0) return cmp;
      if (cmp === 0) {
        if (a.leftClosed !== b.leftClosed) return a.leftClosed ? -1 : 1;
        const rCmp = this.exactCompare(a.right, b.right);
        if (rCmp !== null) return rCmp;
      }
      return 0; // fallback if incomparable
    });

    const result: Interval[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = result[result.length - 1];

      const cmp = this.exactCompare(last.right, current.left);
      
      if (cmp === null) {
        // Can't compare, keep them separate to be safe
        result.push(current);
        continue;
      }

      if (cmp > 0 || (cmp === 0 && (last.rightClosed || current.leftClosed))) {
        // Overlap or touching with at least one closed bound -> merge
        const rightCmp = this.exactCompare(last.right, current.right);
        if (rightCmp === null) {
          result.push(current);
          continue;
        }
        
        if (rightCmp < 0) {
          last.right = current.right;
          last.rightClosed = current.rightClosed;
        } else if (rightCmp === 0) {
          last.rightClosed = last.rightClosed || current.rightClosed;
        }
      } else {
        // No overlap
        result.push(current);
      }
    }

    return result;
  }

  public static union(a: Interval[], b: Interval[]): Interval[] {
    return this.normalizeUnion([...a, ...b].map(interval => ({ ...interval })));
  }

  public static containsEndpoint(intervals: Interval[], endpoint: Endpoint): boolean {
    return intervals.some(interval => {
      const leftComparison = this.exactCompare(interval.left, endpoint);
      const rightComparison = this.exactCompare(endpoint, interval.right);
      const isAfterLeft = leftComparison !== null && (leftComparison < 0 || (leftComparison === 0 && interval.leftClosed));
      const isBeforeRight = rightComparison !== null && (rightComparison < 0 || (rightComparison === 0 && interval.rightClosed));
      return isAfterLeft && isBeforeRight;
    });
  }

  public static intersection(a: Interval[], b: Interval[]): Interval[] {
    const result: Interval[] = [];
    
    for (const intA of a) {
      for (const intB of b) {
        const leftCmp = this.exactCompare(intA.left, intB.left);
        const rightCmp = this.exactCompare(intA.right, intB.right);
        
        if (leftCmp === null || rightCmp === null) {
          // If intervals cannot be compared exactly, we skip or throw.
          // For 4A, we assume comparable intervals.
          continue;
        }

        const maxLeft = leftCmp > 0 ? intA.left : intB.left;
        const maxLeftClosed = leftCmp === 0 ? (intA.leftClosed && intB.leftClosed) : (leftCmp > 0 ? intA.leftClosed : intB.leftClosed);
        
        const minRight = rightCmp < 0 ? intA.right : intB.right;
        const minRightClosed = rightCmp === 0 ? (intA.rightClosed && intB.rightClosed) : (rightCmp < 0 ? intA.rightClosed : intB.rightClosed);

        const crossCmp = this.exactCompare(maxLeft, minRight);
        if (crossCmp === null) continue;

        if (crossCmp < 0) {
          result.push({ left: maxLeft, right: minRight, leftClosed: maxLeftClosed, rightClosed: minRightClosed });
        } else if (crossCmp === 0 && maxLeftClosed && minRightClosed) {
          // Singleton
          result.push({ left: maxLeft, right: minRight, leftClosed: true, rightClosed: true });
        }
      }
    }

    return this.normalizeUnion(result);
  }
}
