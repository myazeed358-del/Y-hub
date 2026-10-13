import * as React from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';

import { ENGINE_CATALOG } from '@/config/majorEngineAccess';

import {
  EngineInfoTooltip,
  type EngineInfoTooltipState,
} from '../components/EngineInfoTooltip';

afterEach(() => {
  cleanup();
});

const firstEngine = ENGINE_CATALOG[0]!;
const secondEngine = ENGINE_CATALOG[1]!;

const tooltip: EngineInfoTooltipState = {
  engineId: firstEngine.id,
  top: 120,
  anchorX: 180,
};

describe('EngineInfoTooltip', () => {
  it('renders nothing without tooltip state', () => {
    render(
      <EngineInfoTooltip
        tooltip={null}
        language="ar"
      />
    );

    expect(
      screen.queryByRole('tooltip')
    ).toBeNull();
  });

  it('ignores unknown engine IDs', () => {
    render(
      <EngineInfoTooltip
        tooltip={{
          ...tooltip,
          engineId: 'unknown-engine-id',
        }}
        language="en"
      />
    );

    expect(
      screen.queryByRole('tooltip')
    ).toBeNull();
  });

  it('shows the Arabic engine title and description', () => {
    render(
      <EngineInfoTooltip
        tooltip={tooltip}
        language="ar"
      />
    );

    const element = screen.getByRole('tooltip');

    expect(element.textContent).toContain(
      firstEngine.title.ar
    );

    expect(element.textContent).toContain(
      firstEngine.description.ar
    );

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  it('uses the original Arabic right-side positioning', () => {
    render(
      <EngineInfoTooltip
        tooltip={tooltip}
        language="ar"
      />
    );

    const element = screen.getByRole('tooltip');

    expect(element.style.top).toBe('120px');

    expect(element.style.right).toBe(
      `${window.innerWidth - 180 + 12}px`
    );

    expect(element.style.left).toBe('');
  });

  it('uses the original English left-side positioning', () => {
    render(
      <EngineInfoTooltip
        tooltip={tooltip}
        language="en"
      />
    );

    const element = screen.getByRole('tooltip');

    expect(element.getAttribute('dir')).toBe('ltr');

    expect(element.style.left).toBe('192px');
    expect(element.style.right).toBe('');

    expect(element.textContent).toContain(
      firstEngine.title.en
    );
  });

  it('updates content when the selected engine changes', () => {
    const { rerender } = render(
      <EngineInfoTooltip
        tooltip={tooltip}
        language="en"
      />
    );

    rerender(
      <EngineInfoTooltip
        tooltip={{
          ...tooltip,
          engineId: secondEngine.id,
        }}
        language="en"
      />
    );

    expect(
      screen.getByRole('tooltip').textContent
    ).toContain(secondEngine.title.en);
  });

  it('preserves fixed, non-interactive tooltip styling', () => {
    render(
      <EngineInfoTooltip
        tooltip={tooltip}
        language="en"
      />
    );

    const element = screen.getByRole('tooltip');

    expect(element.className).toContain(
      'pointer-events-none'
    );

    expect(element.className).toContain(
      'fixed'
    );

    expect(element.className).toContain(
      'z-[9999]'
    );
  });
});
