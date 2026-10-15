import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewApi } from '../../../services/api/interviewApi';
import type { AnswerState } from '../types';


export const useAutosave = (
  sessionId: string,
  answers: AnswerState[],
  version: number | undefined,
  onVersion: (version: number) => void,
  debounceMs: number = 2000,
  enabled: boolean = true,
) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Keep track of the latest answers without triggering effects immediately
  const answersRef = useRef(answers);
  const versionRef = useRef<number | undefined>(
    typeof version === 'number' && version > 0 ? version : undefined
  );
  const saveChainRef = useRef<Promise<number | undefined>>(
    Promise.resolve(versionRef.current)
  );

  useEffect(() => {
    if (
      typeof version === 'number' &&
      version > 0 &&
      (versionRef.current === undefined || version > versionRef.current)
    ) {
      versionRef.current = version;
    }
  }, [version]);
  
  useEffect(() => {
    answersRef.current = answers;
    
    // Save to local session storage for F5 protection
    // Don't overwrite with empty array on initial mount before data is loaded
    if (sessionId && answers.length > 0) {
      sessionStorage.setItem(
        `interview_${sessionId}_answers`,
        JSON.stringify({ version: versionRef.current, answers })
      );
    }
  }, [answers, sessionId, version]);

  const saveSnapshot = useCallback(async (): Promise<number | undefined> => {
    if (!sessionId || answersRef.current.length === 0) return versionRef.current;
    const snapshot = answersRef.current.map((answer) => ({ ...answer }));
    const pending = saveChainRef.current
      .catch(() => versionRef.current)
      .then(async () => {
        const result = await interviewApi.saveInterviewProgress(
          sessionId,
          versionRef.current,
          snapshot
        );
        if (typeof result?.version === 'number') {
          versionRef.current = result.version;
          onVersion(result.version);
        }
        return versionRef.current;
      });
    saveChainRef.current = pending;
    return pending;
  }, [onVersion, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId || answers.length === 0) return;

    const abortController = new AbortController();
    
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await saveSnapshot();
        if (!abortController.signal.aborted) {
          setLastSaved(new Date());
          setIsSaving(false);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Autosave failed:', err);
          setSaveError('Saving failed, retrying...');
          setIsSaving(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [answers, debounceMs, enabled, saveSnapshot, sessionId]);

  // Manually force a save if needed (e.g. before submitting)
  const forceSave = async () => {
    if (!sessionId) return versionRef.current;
    setIsSaving(true);
    setSaveError(null);
    try {
      const savedVersion = await saveSnapshot();
      setLastSaved(new Date());
      return savedVersion;
    } catch (err) {
      console.error('Force save failed:', err);
      setSaveError('Failed to save progress.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, lastSaved, saveError, forceSave };
};
