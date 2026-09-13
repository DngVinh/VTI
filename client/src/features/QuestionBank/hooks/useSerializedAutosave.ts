import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '../../../auth/types';
import type { SaveStatus } from '../types';

interface Options<T> {
  enabled: boolean;
  delayMs?: number;
  save: (value: T) => Promise<void>;
}

export const useSerializedAutosave = <T,>({ enabled, delayMs = 1_500, save }: Options<T>) => {
  const saveRef = useRef(save);
  const latestRef = useRef<T | null>(null);
  const timerRef = useRef<number | null>(null);
  const tailRef = useRef<Promise<void>>(Promise.resolve());
  const changeIdRef = useRef(0);
  const savedIdRef = useRef(0);
  const blockedRef = useRef(false);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { saveRef.current = save; }, [save]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const enqueue = useCallback((): Promise<void> => {
    clearTimer();
    if (!enabled || latestRef.current === null || blockedRef.current) return tailRef.current;
    const snapshot = latestRef.current;
    const snapshotId = changeIdRef.current;

    const operation = tailRef.current.then(async () => {
      if (blockedRef.current || snapshotId <= savedIdRef.current) return;
      setStatus('saving');
      setError(null);
      try {
        await saveRef.current(snapshot);
        savedIdRef.current = snapshotId;
        const stillDirty = changeIdRef.current > savedIdRef.current;
        setDirty(stillDirty);
        setStatus(stillDirty ? 'unsaved' : 'saved');
      } catch (caught) {
        const apiError = caught as ApiError;
        const isConflict = apiError.status === 409 || apiError.code === 'QUESTION_REVISION_CONFLICT';
        blockedRef.current = isConflict;
        setStatus(isConflict ? 'conflict' : 'error');
        setError(apiError.message || 'Không thể lưu Draft.');
        throw caught;
      }
    });
    tailRef.current = operation.catch(() => undefined);
    return operation;
  }, [clearTimer, enabled]);

  const schedule = useCallback((value: T, saveable = true) => {
    latestRef.current = value;
    changeIdRef.current += 1;
    setDirty(true);
    if (blockedRef.current) return;
    setStatus('unsaved');
    setError(null);
    clearTimer();
    if (enabled && saveable) {
      timerRef.current = window.setTimeout(() => {
        void enqueue().catch(() => undefined);
      }, delayMs);
    }
  }, [clearTimer, delayMs, enabled, enqueue]);

  const markSaved = useCallback((value?: T) => {
    clearTimer();
    if (value !== undefined) latestRef.current = value;
    savedIdRef.current = changeIdRef.current;
    blockedRef.current = false;
    setDirty(false);
    setStatus('saved');
    setError(null);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { status, error, dirty, schedule, saveNow: enqueue, markSaved };
};

