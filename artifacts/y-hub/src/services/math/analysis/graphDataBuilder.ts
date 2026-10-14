import type { SolutionSet, Interval, Endpoint } from '../types/set';
import type { GraphData, Asymptote, CriticalPoint, ExtremaPoint, InflectionPoint, DiscontinuityPoint } from '../types/analysis';
import { ASTUtils } from '../symbolic/utils';
import { SetEngine } from '../symbolic/sets';

/** Builds plot metadata from already computed analysis results. */
export class GraphDataBuilder {
public build(domain: SolutionSet, cps: CriticalPoint[], inc: Interval[], dec: Interval[], up: Interval[], down: Interval[], asymptotes: Asymptote[], intercepts: Endpoint[], extrema: ExtremaPoint[], infs: InflectionPoint[], discontinuities: DiscontinuityPoint[]): GraphData {
    const importantPoints: Endpoint[] = [];
    cps.forEach(c => importantPoints.push(c.point));
    intercepts.forEach(i => importantPoints.push(i));
    extrema.forEach(e => importantPoints.push(e.point));
    infs.forEach(i => importantPoints.push(i.point));
    discontinuities.forEach(d => importantPoints.push(d.point));

    // Sort and deduplicate endpoints
    const uniquePoints = new Map<string, Endpoint>();
    for (const p of importantPoints) {
      if (p.type === 'value') uniquePoints.set(ASTUtils.structuralKey(p.ast), p);
    }
    const sortedPoints = Array.from(uniquePoints.values()).sort((a, b) => SetEngine.exactCompare(a, b) || 0);

    const segments: import('../types/analysis').GraphSegment[] = [];

    for (const iv of domain.intervals) {
       // split interval by sortedPoints
       let currentLeft = iv.left;
       let currentLeftClosed = iv.leftClosed;

       for (const pt of sortedPoints) {
          const cmpLeft = SetEngine.exactCompare(currentLeft, pt);
          const cmpRight = SetEngine.exactCompare(pt, iv.right);

          if (cmpLeft !== null && cmpLeft < 0 && cmpRight !== null && cmpRight < 0) {
             // pt is strictly inside the current sub-interval
             const subIv: Interval = { left: currentLeft, right: pt, leftClosed: currentLeftClosed, rightClosed: false };
             segments.push({
               interval: subIv,
               monotonicity: this.getMonotonicity(subIv, inc, dec),
               concavity: this.getConcavity(subIv, up, down)
             });

             currentLeft = pt;
             currentLeftClosed = false;
          }
       }

       const lastIv: Interval = { left: currentLeft, right: iv.right, leftClosed: currentLeftClosed, rightClosed: iv.rightClosed };
       segments.push({
         interval: lastIv,
         monotonicity: this.getMonotonicity(lastIv, inc, dec),
         concavity: this.getConcavity(lastIv, up, down)
       });
    }

    // Suggested plotting range
    let xMin = -10, xMax = 10, yMin = -10, yMax = 10;
    // We could expand this based on extrema, but uncontrolled numerical expansion is forbidden.

    return {
       domainIntervals: domain.intervals,
       criticalPoints: cps,
       intercepts,
       extrema,
       inflectionPoints: infs,
       verticalAsymptotes: asymptotes.filter(a => a.type === 'vertical'),
       horizontalAsymptotes: asymptotes.filter(a => a.type === 'horizontal'),
       slantAsymptotes: asymptotes.filter(a => a.type === 'slant'),
       behaviorSegments: segments,
       suggestedPlottingRange: { xMin, xMax, yMin, yMax }
    };
  }

private getMonotonicity(iv: Interval, inc: Interval[], dec: Interval[]): 'increasing' | 'decreasing' | 'constant' | 'unknown' {
     // Check if iv is subset of any inc interval
     for (const i of inc) {
        const cL = SetEngine.exactCompare(i.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, i.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'increasing';
     }
     for (const d of dec) {
        const cL = SetEngine.exactCompare(d.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, d.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'decreasing';
     }
     return 'unknown';
  }

private getConcavity(iv: Interval, up: Interval[], down: Interval[]): 'concave_up' | 'concave_down' | 'linear' | 'unknown' {
     for (const u of up) {
        const cL = SetEngine.exactCompare(u.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, u.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'concave_up';
     }
     for (const d of down) {
        const cL = SetEngine.exactCompare(d.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, d.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'concave_down';
     }
     return 'unknown';
  }
}
