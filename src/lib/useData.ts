import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Loads data whenever the screen comes into focus, so tabs stay fresh after a workout.
 * A failed load is rethrown during render so the root error screen shows it.
 */
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[] = []): [T | undefined, () => void] {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const reload = useCallback(() => {
    let cancelled = false;
    load().then(
      (d) => {
        if (!cancelled) setData(d);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(reload);
  if (error) throw error;
  return [data, reload];
}
