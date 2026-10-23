import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecoveryMap } from '../../components/RecoveryMap';
import { Button, Card, SectionLabel } from '../../components/ui';
import { activeWorkoutId, loadExercises, loadHistory, loadSettings, startWorkout } from '../../lib/db';
import { MUSCLE_LABELS } from '../../lib/format';
import { generateWorkout, type GeneratedWorkout } from '../../lib/generator';
import { colors, space, type } from '../../lib/theme';
import type { Exercise, Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';

interface TodayData {
  workout: GeneratedWorkout;
  exercises: Map<string, Exercise>;
  settings: Settings;
  activeId: number | null;
  weekSessions: number;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  // Bumping the seed regenerates the plan with fresh history.
  const [seed, setSeed] = useState(0);
  const [data] = useFocusData<TodayData>(async () => {
    const [exercises, history, settings, activeId] = await Promise.all([
      loadExercises(db),
      loadHistory(db, 30),
      loadSettings(db),
      activeWorkoutId(db),
    ]);
    const weekAgo = Date.now() - 7 * 864e5;
    const weekSessions = new Set(
      history.filter((s) => new Date(s.completedAt).getTime() >= weekAgo).map((s) => s.completedAt.slice(0, 10)),
    ).size;
    // Skip exercises the user just saw when they ask for a different plan.
    const rotated = seed === 0 ? exercises : exercises.filter((_, i) => (i + seed) % 4 !== 0);
    return {
      workout: generateWorkout(rotated, history, settings),
      exercises: new Map(exercises.map((e) => [e.id, e])),
      settings,
      activeId,
      weekSessions,
    };
  }, [seed]);

  if (!data) return <View style={styles.screen} />;
  const { workout, exercises, settings, activeId, weekSessions } = data;

  const begin = async () => {
    if (activeId == null) await startWorkout(db, workout.exercises);
    router.push('/workout');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>{weekSessions} {weekSessions === 1 ? 'SESSION' : 'SESSIONS'} THIS WEEK</Text>
      <Text style={[type.hero, { marginTop: space.xs }]}>
        {workout.focus.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(' · ')}
      </Text>
      <Text style={[type.body, { color: colors.textMuted, marginTop: space.xs }]}>
        {workout.exercises.length} exercises · about {settings.minutes} min · {settings.goal}
      </Text>

      <Button
        title={activeId != null ? 'Resume workout' : 'Start workout'}
        onPress={begin}
        style={{ marginTop: space.lg }}
      />

      <SectionLabel>Today's plan</SectionLabel>
      <Card style={{ paddingVertical: space.xs }}>
        {workout.exercises.map((p, i) => {
          const e = exercises.get(p.exerciseId)!;
          return (
            <Pressable
              key={p.exerciseId}
              onPress={() => router.push(`/exercise/${p.exerciseId}`)}
              style={[styles.row, i > 0 && styles.rowBorder]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{e.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.sets} × {p.targetReps} reps · {p.targetRir} in reserve
                </Text>
              </View>
              <Text style={styles.rowWeight}>
                {p.suggestedWeight != null ? `${p.suggestedWeight} ${settings.units}` : e.equipment === 'bodyweight' ? 'BW' : 'New'}
              </Text>
            </Pressable>
          );
        })}
      </Card>
      <Button title="Try a different plan" variant="secondary" onPress={() => setSeed((s) => s + 1)} style={{ marginTop: space.md }} />

      <SectionLabel>Recovery</SectionLabel>
      <Card>
        <RecoveryMap recovery={workout.recovery} />
        <Text style={[styles.rowMeta, { marginTop: space.md }]}>
          Based on your last 72 hours of training. Sleep and HRV from Apple Health come in a later version.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, paddingBottom: space.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  rowWeight: { color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
