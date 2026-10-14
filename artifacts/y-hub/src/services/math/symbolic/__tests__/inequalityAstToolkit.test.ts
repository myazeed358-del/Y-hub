import { describe, expect, it } from 'vitest';
import { InequalityAstToolkit } from '../inequalityAstToolkit';

const num = (value: string) => ({ type: 'Number' as const, value });

describe('Inequality AST transformation boundary', () => {
  const transforms = new InequalityAstToolkit();
  it('recognizes nested absolute-value expressions independently of the solver', () => {
    const nested = { type: 'Function' as const, name: 'abs', args: [
      { type: 'Function' as const, name: 'abs', args: [num('3')] },
    ] };
    expect(transforms.findAbsNodes(nested)).toHaveLength(2);
    expect(transforms.hasNestedAbs(nested)).toBe(true);
  });
  it('preserves original AST while replacing a known radical with a token', () => {
    const rad = { type: 'Function' as const, name: 'sqrt', args: [num('2')] };
    const original = JSON.stringify(rad);
    expect(transforms.replaceRadicalWithSymbol(rad, JSON.stringify(num('2')))).toEqual({ type: 'Symbol', name: '___RAD___' });
    expect(JSON.stringify(rad)).toBe(original);
  });
  it('fractionalizes products without losing the denominator', () => {
    const product = { type: 'Operator' as const, operator: '*' as const, args: [num('2'), {
      type: 'Operator' as const, operator: '/' as const, args: [num('3'), num('5')],
    }] };
    const out = transforms.fractionalize(product);
    expect(out.num.type).toBe('Operator');
    expect(out.den.type).toBe('Operator');
  });
});
