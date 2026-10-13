import * as React from 'react';

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

/**
 * This test verifies module exports and identity only.
 *
 * AppShell imports AuthContext, which initializes
 * Supabase at module evaluation time.
 *
 * Mocking AuthContext keeps this architectural
 * contract test independent of database credentials.
 *
 * The AppShellController itself is NOT mocked.
 */
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as appShellPublicApi from '../index';

import {
  AppShell as ControllerAppShell,
} from '../components/AppShellController';

import {
  AppShell as LegacyAppShell,
} from '@/components/layout/AppShell';

describe('AppShellPublicApi', () => {
  it('exports AppShell publicly', () => {
    expect(typeof appShellPublicApi.AppShell)
      .toBe('function');
  });

  it('exports the actual AppShellController', () => {
    expect(appShellPublicApi.AppShell)
      .toBe(ControllerAppShell);
  });

  it('preserves the legacy facade identity', () => {
    expect(LegacyAppShell)
      .toBe(appShellPublicApi.AppShell);
  });

  it('supports React element creation', () => {
    const element = React.createElement(
      appShellPublicApi.AppShell,
      null,
      'Academic content'
    );

    expect(element.type)
      .toBe(ControllerAppShell);

    expect(element.props.children)
      .toBe('Academic content');
  });
});
