import {
  describe,
  expect,
  it,
} from 'vitest';

import { toError } from '../toError';

describe('toError', () => {
  it('preserves existing Error instances', () => {
    const error = new Error('Existing error');

    expect(toError(error)).toBe(error);
  });

  it('converts strings into errors', () => {
    expect(toError('Example failure').message)
      .toBe('Example failure');
  });

  it('converts objects into readable errors', () => {
    const result = toError({
      code: 'INVALID_STATE',
    });

    expect(result.message)
      .toContain('INVALID_STATE');
  });

  it('handles circular objects safely', () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() => toError(value)).not.toThrow();
    expect(toError(value)).toBeInstanceOf(Error);
  });

  it('handles null values', () => {
    expect(toError(null).message).toBe('null');
  });
});
