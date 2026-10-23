import { useSQLiteContext } from 'expo-sqlite';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { WorkoutForStrava } from '../lib/strava';
import { useFocusData } from '../lib/useData';
import { colors, radius, space, TAP } from '../lib/theme';
import { loadStravaLink, postWorkoutToStrava, StravaError } from '../services/strava';

/** "Post to Strava" on the workout summary. Shown only when Strava is connected; never posts on its own. */
export function StravaShare({ workout }: { workout: WorkoutForStrava }) {
  const db = useSQLiteContext();
  const [link] = useFocusData(() => loadStravaLink(db));
  const [state, setState] = useState<{ kind: 'idle' | 'posting' } | { kind: 'posted'; url: string } | { kind: 'error'; message: string }>({ kind: 'idle' });
  if (!link) return null;

  const post = async () => {
    setState({ kind: 'posting' });
    try {
      setState({ kind: 'posted', url: await postWorkoutToStrava(db, workout) });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof StravaError ? error.message : 'Couldn’t post to Strava. Try again.' });
    }
  };

  if (state.kind === 'posted') {
    return (
      <Pressable onPress={() => Linking.openURL(state.url)} accessibilityRole="link" style={styles.posted}>
        <Text style={styles.postedText}>Posted to Strava · View</Text>
      </Pressable>
    );
  }
  return (
    <>
      <Pressable
        onPress={post}
        disabled={state.kind === 'posting'}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, (pressed || state.kind === 'posting') && { opacity: 0.8 }]}
      >
        <Text style={styles.buttonText}>{state.kind === 'posting' ? 'Posting…' : 'Post to Strava'}</Text>
      </Pressable>
      {state.kind === 'error' && <Text style={styles.error}>{state.message}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TAP,
    borderRadius: radius.md,
    backgroundColor: colors.strava,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
  },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  posted: { minHeight: TAP, alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  postedText: { color: colors.strava, fontSize: 17, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, marginTop: space.sm, textAlign: 'center' },
});
