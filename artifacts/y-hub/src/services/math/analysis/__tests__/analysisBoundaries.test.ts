import { describe, expect, it } from 'vitest';
import type { CanonicalAST } from '../../types/ast';
import { classifyFunction } from '../functionClassification';
import { GraphDataBuilder } from '../graphDataBuilder';

const x: CanonicalAST = { type: 'Symbol', name: 'x' };

describe('Function analysis independent services', () => {
  it('classifies expressions without orchestrator instances', () => {
    expect(classifyFunction(x)).toEqual(['polynomial']);
    expect(classifyFunction({ type: 'Function', name: 'sin', args: [x] })).toEqual(['trigonometric']);
  });

  it('builds graph segments from stable domain and monotonicity data', () => {
    const domain = {
      type: 'SolutionSet' as const,
      variable: 'x', domainRestrictions: [],
      intervals: [{
        left: { type: 'infinity' as const, sign: -1 as const },
        right: { type: 'infinity' as const, sign: 1 as const },
        leftClosed: false, rightClosed: false,
      }],
    };
    const graph = new GraphDataBuilder().build(domain, [], domain.intervals, [], [], [], [], [], [], [], []);
    expect(graph.behaviorSegments).toHaveLength(1);
    expect(graph.behaviorSegments[0].monotonicity).toBe('increasing');
  });
});
