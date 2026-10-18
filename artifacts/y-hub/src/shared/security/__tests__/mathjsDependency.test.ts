import { describe, expect, it } from 'vitest';
import { evaluate, matrix } from 'mathjs';

// Benign probes of the upstream 15.2.0 security fixes. No code execution,
// process/filesystem access, prototype changes or production requests.
describe('mathjs dependency sandbox regressions', () => {
  it('forbids replacing methods on raw arrays through the expression parser', () => {
    expect(() => evaluate(
      "a = reviver('', {'mathjs': 'ArrayNode'}).map().toJSON()['items']; a.map = 123",
    )).toThrow(/No access to property "map"/);
  });
  it('rejects a forged array-like matrix index before using its properties', () => {
    const value = matrix([10, 20]);
    expect(() => value.get({ length: 1, 0: 0 } as never)).toThrow(/Array expected for index/);
    expect(value.get([0])).toBe(10);
  });
});
