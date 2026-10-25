import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useAcademicResource } from '../hooks/useAcademicResource';
it('ignores a response for a previous user/filter without exposing stale rows', async () => {
  let resolve!: (value: string[]) => void;
  const previous = new Promise<string[]>(r => { resolve = r; });
  const { result, rerender } = renderHook(({ key }) => useAcademicResource(key, () => key === 'old' ? previous : Promise.resolve(['new'])), { initialProps: { key: 'old' } });
  rerender({ key: 'new' });
  await waitFor(() => expect(result.current.data).toEqual(['new']));
  await act(async () => resolve(['private old data']));
  expect(result.current.data).toEqual(['new']);
});
it('reports unavailable data instead of an empty successful list', async () => {
  const { result } = renderHook(() => useAcademicResource('error', () => Promise.reject(Error('RLS'))));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.data).toBeUndefined();
});
