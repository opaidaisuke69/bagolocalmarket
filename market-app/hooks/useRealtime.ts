import { useEffect, useRef, useCallback } from 'react';

/**
 * Poll a function every `interval` ms without causing re-renders.
 * Silently updates data in the background — no loading states.
 */
export function useRealtime(
  fetchFn: () => Promise<void>,
  interval: number = 3000,
  enabled: boolean = true
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef(fetchFn);

  // Always keep the latest fetch function ref
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      fetchRef.current().catch(() => {
        // Silent failure — don't disrupt the user
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, enabled]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { stop };
}
