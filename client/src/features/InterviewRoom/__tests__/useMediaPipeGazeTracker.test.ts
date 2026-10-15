import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMediaPipeGazeTracker } from '../hooks/useMediaPipeGazeTracker';

describe('useMediaPipeGazeTracker (Micro-Task 5.9)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useMediaPipeGazeTracker());

    expect(result.current.isTracking).toBe(false);
    expect(result.current.eyeContactRatio).toBe(1.0);
    expect(result.current.offScreenDurationSeconds).toBe(0);
    expect(result.current.isLookingAtScreen).toBe(true);
  });

  it('starts and stops tracking', () => {
    const { result } = renderHook(() => useMediaPipeGazeTracker());

    act(() => {
      result.current.startTracking();
    });
    expect(result.current.isTracking).toBe(true);

    act(() => {
      result.current.stopTracking();
    });
    expect(result.current.isTracking).toBe(false);
  });

  it('calculates eyeContactRatio from recorded samples', () => {
    const { result } = renderHook(() => useMediaPipeGazeTracker());

    act(() => {
      result.current.startTracking();
      result.current.recordGazeSample(true);
      result.current.recordGazeSample(true);
      result.current.recordGazeSample(true);
      result.current.recordGazeSample(false); // 3 true out of 4 = 75% = 0.75
    });

    expect(result.current.eyeContactRatio).toBe(0.75);
    expect(result.current.isLookingAtScreen).toBe(false);
  });

  it('tracks offScreenDurationSeconds and resets when looking back', () => {
    const { result } = renderHook(() => useMediaPipeGazeTracker());

    act(() => {
      result.current.startTracking();
      result.current.recordGazeSample(false);
      result.current.recordGazeSample(false);
    });

    expect(result.current.offScreenDurationSeconds).toBe(2);
    expect(result.current.isLookingAtScreen).toBe(false);

    act(() => {
      result.current.recordGazeSample(true);
    });

    expect(result.current.offScreenDurationSeconds).toBe(0);
    expect(result.current.isLookingAtScreen).toBe(true);
  });
});
