import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInterviewTimer } from '../hooks/useInterviewTimer';

describe('useInterviewTimer Hook (M-7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with given seconds and counts down every second', () => {
    const { result } = renderHook(() => useInterviewTimer(60, null));

    expect(result.current.timeLeft).toBe(60);
    expect(result.current.formattedTime).toBe('01:00');
    expect(result.current.progressRatio).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timeLeft).toBe(59);
    expect(result.current.formattedTime).toBe('00:59');
  });

  it('cleans up timeout on unmount when startTime is provided', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const startTime = new Date(Date.now() - 10000).toISOString();

    const { unmount } = renderHook(() => useInterviewTimer(60, startTime));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('fires onTimeUp when countdown reaches 0', () => {
    const onTimeUp = vi.fn();
    const { result } = renderHook(() => useInterviewTimer(2, null, onTimeUp));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.timeLeft).toBe(0);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });
});
