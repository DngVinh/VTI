import { useState, useCallback, useRef } from 'react';

export interface GazeTrackerResult {
  isTracking: boolean;
  eyeContactRatio: number; // 0.0 - 1.0
  offScreenDurationSeconds: number;
  isLookingAtScreen: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  recordGazeSample: (isLooking: boolean) => void;
}

export function useMediaPipeGazeTracker(): GazeTrackerResult {
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [eyeContactRatio, setEyeContactRatio] = useState<number>(1.0);
  const [offScreenDurationSeconds, setOffScreenDurationSeconds] = useState<number>(0);
  const [isLookingAtScreen, setIsLookingAtScreen] = useState<boolean>(true);

  const totalSamplesRef = useRef<number>(0);
  const lookingSamplesRef = useRef<number>(0);
  const offScreenCountRef = useRef<number>(0);

  const startTracking = useCallback(() => {
    setIsTracking(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  const recordGazeSample = useCallback((isLooking: boolean) => {
    totalSamplesRef.current += 1;
    if (isLooking) {
      lookingSamplesRef.current += 1;
      offScreenCountRef.current = 0;
      setOffScreenDurationSeconds(0);
      setIsLookingAtScreen(true);
    } else {
      offScreenCountRef.current += 1;
      setOffScreenDurationSeconds(offScreenCountRef.current);
      setIsLookingAtScreen(false);
    }

    const ratio =
      totalSamplesRef.current > 0
        ? lookingSamplesRef.current / totalSamplesRef.current
        : 1.0;
    setEyeContactRatio(Number(ratio.toFixed(2)));
  }, []);

  return {
    isTracking,
    eyeContactRatio,
    offScreenDurationSeconds,
    isLookingAtScreen,
    startTracking,
    stopTracking,
    recordGazeSample,
  };
}
