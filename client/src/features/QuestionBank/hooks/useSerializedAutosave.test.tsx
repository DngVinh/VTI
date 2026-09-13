import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSerializedAutosave } from './useSerializedAutosave';

describe('serialized Question Bank autosave', () => {
  afterEach(() => vi.useRealTimers());

  it('debounces changes and never overlaps save requests', async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    const save = vi.fn(() => new Promise<void>((resolve) => resolvers.push(resolve)));
    const { result } = renderHook(() => useSerializedAutosave({ enabled: true, delayMs: 1_500, save }));

    act(() => result.current.schedule({ prompt: 'one' }));
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(save).toHaveBeenCalledTimes(1);
    act(() => result.current.schedule({ prompt: 'two' }));
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { resolvers.shift()?.(); await Promise.resolve(); });
    expect(save).toHaveBeenCalledTimes(2);
    await act(async () => { resolvers.shift()?.(); await Promise.resolve(); });
    expect(result.current.status).toBe('saved');
  });

  it('stops subsequent mutations after a revision conflict and preserves dirty state', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue({ status: 409, code: 'QUESTION_REVISION_CONFLICT', message: 'Conflict' });
    const { result } = renderHook(() => useSerializedAutosave({ enabled: true, delayMs: 1_500, save }));
    act(() => result.current.schedule({ prompt: 'local content' }));
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(result.current.status).toBe('conflict');
    expect(result.current.dirty).toBe(true);
    act(() => result.current.schedule({ prompt: 'still local' }));
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(save).toHaveBeenCalledTimes(1);
  });
});

