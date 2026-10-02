import { DiscreteFuzzyPoint, FuzzyDefuzzificationMethod } from './types';

export class DefuzzificationEngine {
  
  public executeDiscrete(points: DiscreteFuzzyPoint[], method: FuzzyDefuzzificationMethod | 'weighted_average' | 'weighted_sum', inputType?: 'singletons' | 'aggregated_set'): { value: number, status: string, trace: any[] } {
    if (!points || points.length === 0) return { value: 0, status: 'invalid_domain', trace: [{ step: 'Validation', desc: 'Empty point set' }] };
    
    if ((method === 'weighted_average' || method === 'weighted_sum') && inputType !== 'singletons') {
      return { value: 0, status: 'invalid_domain', trace: [{ step: 'Validation', desc: 'invalid_method_for_input: Weighted methods require singleton inputs.' }] };
    }

    let sumY = 0;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.y < 0) return { value: 0, status: 'invalid_domain', trace: [{ step: 'Validation', desc: 'Negative membership detected' }] };
      sumY += p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    if (sumY === 0 && (method === 'centroid' || method === 'bisector' || method === 'weighted_average')) {
      return { value: 0, status: 'zero_area', trace: [{ step: 'Validation', desc: 'Zero area blocks operation' }] };
    }

    const trace: any[] = [];
    let value = 0;

    switch (method) {
      case 'centroid':
      case 'weighted_average': {
        let sumXY = 0;
        for (const p of points) sumXY += p.x * p.y;
        value = sumXY / sumY;
        trace.push({ step: 'Compute', desc: \Sum(x*y) = \, Sum(y) = \, Value = \\ });
        break;
      }
      case 'weighted_sum': {
        let sumXY = 0;
        for (const p of points) sumXY += p.x * p.y;
        value = sumXY;
        trace.push({ step: 'Compute', desc: \Sum(x*y) = \. No normalization applied for weighted_sum.\ });
        break;
      }
      case 'bisector': {
        // Discrete bisector explicitly uses cumulative nearest neighbor sum mapping
        let currentArea = 0;
        const targetArea = sumY / 2;
        let bisectorX = points[0].x;
        for (let i = 0; i < points.length; i++) {
          currentArea += points[i].y;
          if (currentArea >= targetArea) {
            bisectorX = points[i].x;
            break;
          }
        }
        value = bisectorX;
        trace.push({ step: 'Compute', desc: \Discrete cumulative area crossed target \ at x = \\ });
        break;
      }
      case 'mom':
      case 'som':
      case 'lom': {
        // Evaluate maximum with 1e-12 tolerance
        const maxPoints = points.filter(p => p.y >= maxY - 1e-12);
        if (method === 'mom') {
          value = maxPoints.reduce((sum, p) => sum + p.x, 0) / maxPoints.length;
          trace.push({ step: 'Compute', desc: 'MOM calculated over maximum plateau' });
        } else if (method === 'som') {
          value = Math.min(...maxPoints.map(p => p.x));
          trace.push({ step: 'Compute', desc: 'Smallest x from plateau' });
        } else {
          value = Math.max(...maxPoints.map(p => p.x));
          trace.push({ step: 'Compute', desc: 'Largest x from plateau' });
        }
        break;
      }
    }
    
    return { value, status: 'success', trace };
  }
}
