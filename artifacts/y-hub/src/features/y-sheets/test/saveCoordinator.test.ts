import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbookSaveCoordinator } from '../integration/saveCoordinator';
import { createDefaultWorkbook } from '../state/defaultWorkbook';

afterEach(() => {
  vi.useRealTimers();
});

describe('Y-Sheets save coordinator', () => {
  it('does not save on initialization', () => {
    const save = vi.fn(async () => {});
    new WorkbookSaveCoordinator(save, () => {});
    expect(save).not.toHaveBeenCalled();
  });

  it('debounces changes and saves the latest snapshot', async () => {
    vi.useFakeTimers();

    const save = vi.fn(async () => {});
    const coordinator = new WorkbookSaveCoordinator(save, () => {});

    const first = { ...createDefaultWorkbook(), name: 'First' };
    const latest = { ...first, name: 'Latest' };

    coordinator.enqueue(first);
    coordinator.enqueue(latest);

    await vi.advanceTimersByTimeAsync(750);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(latest);
    expect(coordinator.status).toBe('saved');
  });

  it('serializes saves when edits arrive during a request', async () => {
    let release!: () => void;

    const deferred = new Promise<void>(resolve => {
      release = resolve;
    });

    const save = vi.fn()
      .mockImplementationOnce(() => deferred)
      .mockResolvedValue(undefined);

    const coordinator = new WorkbookSaveCoordinator(save, () => {});
    const first = { ...createDefaultWorkbook(), name: 'First' };
    const second = { ...first, name: 'Second' };

    coordinator.enqueue(first);
    const running = coordinator.flush();

    coordinator.enqueue(second);
    release();

    await running;

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(second);
    expect(coordinator.status).toBe('saved');
  });

  it('retries transient failures', async () => {
    vi.useFakeTimers();

    const save = vi.fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue(undefined);

    const coordinator = new WorkbookSaveCoordinator(save, () => {});
    coordinator.enqueue(createDefaultWorkbook());

    await vi.advanceTimersByTimeAsync(1500);

    expect(save).toHaveBeenCalledTimes(2);
    expect(coordinator.status).toBe('saved');
  });

  it('preserves unsaved changes when a conflict occurs', async () => {
    const save = vi.fn()
      .mockRejectedValue(new Error('Workbook conflict'));

    const coordinator = new WorkbookSaveCoordinator(save, () => {});
    coordinator.enqueue(createDefaultWorkbook());

    await expect(coordinator.flush()).rejects.toThrow('conflict');

    expect(coordinator.status).toBe('conflict');
    expect(coordinator.hasUnsavedChanges).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
