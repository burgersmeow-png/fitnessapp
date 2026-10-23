import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Loads data whenever the screen comes into focus, so tabs stay fresh after a workout. */
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[] = []): [T | undefined, () => void] {
  const [data, setData] = useState<T>();
  const reload = useCallback(() => {
    let cancelled = false;
    load().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(reload);
  return [data, reload];
}
