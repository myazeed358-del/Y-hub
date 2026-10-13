import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';

import {
  useEngineInfoTooltip,
} from '../hooks/useEngineInfoTooltip';

const sampleTooltip = {
  engineId: 'engine-one',
  top: 120,
  anchorX: 180,
};

afterEach(() => {
  cleanup();
});

describe('useEngineInfoTooltip', () => {
  it('starts with no visible tooltip', () => {
    const { result } = renderHook(
      () => useEngineInfoTooltip()
    );

    expect(result.current.engineInfoTooltip).toBeNull();
  });

  it('stores the selected engine and position', () => {
    const { result } = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    expect(result.current.engineInfoTooltip)
      .toEqual(sampleTooltip);
  });

  it('updates the selected engine', () => {
    const { result } = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    act(() => {
      result.current.setEngineInfoTooltip({
        engineId: 'engine-two',
        top: 240,
        anchorX: 350,
      });
    });

    expect(result.current.engineInfoTooltip?.engineId)
      .toBe('engine-two');

    expect(result.current.engineInfoTooltip?.top)
      .toBe(240);
  });

  it('closes the tooltip when set to null', () => {
    const { result } = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    act(() => {
      result.current.setEngineInfoTooltip(null);
    });

    expect(result.current.engineInfoTooltip).toBeNull();
  });

  it('supports React functional state updates', () => {
    const { result } = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    act(() => {
      result.current.setEngineInfoTooltip(
        (current) => current
          ? { ...current, top: 300 }
          : current
      );
    });

    expect(result.current.engineInfoTooltip)
      .toEqual({
        ...sampleTooltip,
        top: 300,
      });
  });

  it('preserves the state during rerender', () => {
    const { result, rerender } = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    const originalSetter =
      result.current.setEngineInfoTooltip;

    rerender();

    expect(result.current.engineInfoTooltip)
      .toEqual(sampleTooltip);

    expect(result.current.setEngineInfoTooltip)
      .toBe(originalSetter);
  });

  it('keeps separate hook instances independent', () => {
    const first = renderHook(
      () => useEngineInfoTooltip()
    );

    const second = renderHook(
      () => useEngineInfoTooltip()
    );

    act(() => {
      first.result.current.setEngineInfoTooltip(
        sampleTooltip
      );
    });

    expect(first.result.current.engineInfoTooltip)
      .toEqual(sampleTooltip);

    expect(second.result.current.engineInfoTooltip)
      .toBeNull();

    first.unmount();
    second.unmount();
  });
});
