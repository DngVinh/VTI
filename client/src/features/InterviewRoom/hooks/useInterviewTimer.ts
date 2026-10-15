import { useState, useEffect } from 'react';

export const useInterviewTimer = (initialSeconds: number = 1200, startTime: Date | string | null, onTimeUp?: () => void) => {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!startTime) return initialSeconds;
    
    // Calculate end time based on the server's start time
    const startMs = new Date(startTime).getTime();
    const endMs = startMs + initialSeconds * 1000;
    const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
    return remaining;
  });

  // Re-calculate when startTime becomes available
  useEffect(() => {
    if (startTime) {
      const startMs = new Date(startTime).getTime();
      const endMs = startMs + initialSeconds * 1000;
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      // Avoid calling setState synchronously within an effect body
      const timerId = setTimeout(() => setTimeLeft(remaining), 0);
      return () => clearTimeout(timerId);
    }
  }, [startTime, initialSeconds]);

  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) {
      if (timeLeft === 0 && onTimeUp) {
        onTimeUp();
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prevTime) => Math.max(0, prevTime - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onTimeUp]);

  const toggleTimer = () => setIsActive(!isActive);
  const stopTimer = () => setIsActive(false);

  // Format time as MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Progress ratio (0 to 1) for visual alerts
  const progressRatio = timeLeft / initialSeconds;

  return {
    timeLeft,
    formattedTime,
    progressRatio,
    isActive,
    toggleTimer,
    stopTimer,
  };
};
