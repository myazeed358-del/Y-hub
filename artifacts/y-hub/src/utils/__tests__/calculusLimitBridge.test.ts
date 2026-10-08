import { describe, expect, it } from 'vitest';
import { evaluateCalculusLimit } from '../calculusLimitBridge';

describe('Calculus II limit bridge', () => {
  it('evaluates a polynomial limit', () => {
    const result = evaluateCalculusLimit('x^2 + 2*x + 1', '2', 'both');
    expect(result.classification).toBe('finite');
    expect(result.valueLatex).toBe('9');
  });

  it('evaluates sin(x)/x at zero', () => {
    const result = evaluateCalculusLimit('sin(x)/x', '0', 'both');
    expect(result.classification).toBe('finite');
    expect(result.valueLatex).toBe('1');
  });

  it('detects positive infinity from the right', () => {
    const result = evaluateCalculusLimit('1/x', '0', 'right');
    expect(result.classification).toBe('+infinity');
    expect(result.valueLatex).toBe('+\\infty');
  });

  it('detects negative infinity from the left', () => {
    const result = evaluateCalculusLimit('1/x', '0', 'left');
    expect(result.classification).toBe('-infinity');
  });

  it('detects a missing two-sided limit', () => {
    const result = evaluateCalculusLimit('1/x', '0', 'both');
    expect(result.classification).toBe('does_not_exist');
    expect(result.valueLatex).toBeNull();
  });

  it('evaluates limits at infinity', () => {
    const result = evaluateCalculusLimit('x/(x+1)', 'inf', 'both');
    expect(result.classification).toBe('finite');
    expect(result.valueLatex).toBe('1');
  });

  it('rejects invalid approach values', () => {
    expect(() =>
      evaluateCalculusLimit('x^2', 'something', 'both')
    ).toThrow();
  });
});
