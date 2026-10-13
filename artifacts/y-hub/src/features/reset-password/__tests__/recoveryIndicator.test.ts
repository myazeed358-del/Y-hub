import { describe, expect, it } from 'vitest';
import { hasRecoveryIndicator } from '../domain/hasRecoveryIndicator';

describe('hasRecoveryIndicator', () => {
  const base = 'https://example.com/reset-password';

  it('recognizes recovery hash', () => {
    expect(
      hasRecoveryIndicator(base + '#type=recovery', false)
    ).toBe(true);
  });

  it('recognizes recovery code', () => {
    expect(
      hasRecoveryIndicator(base + '?code=abc', false)
    ).toBe(true);
  });

  it('recognizes a prior recovery event', () => {
    expect(
      hasRecoveryIndicator(base, true)
    ).toBe(true);
  });

  it('rejects unrelated URLs', () => {
    expect(
      hasRecoveryIndicator(base + '#type=signup', false)
    ).toBe(false);
  });
});
