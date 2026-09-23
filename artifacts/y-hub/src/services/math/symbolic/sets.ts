import { Endpoint, Interval, SolutionSet } from '../types/set';
import { ASTUtils } from './utils';
import { Rat } from './series';

export class SetEngine {
  
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
