import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { ExercisePrefs } from '../lib/exercisePrefs';
import { loadPrefs } from '../services/exercisePrefs';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoachBar } from '../components/CoachBar';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { Button, Loading } from '../components/ui';
import { cardioFatigue } from '../lib/cardio';
import { activeWorkoutId, fromKg, loadCardio, loadExercises, loadHistory, loadSettings, startWorkout } from '../lib/db';
import { formatNumber } from '../lib/format';
import { generateWorkout, type GeneratedWorkout } from '../lib/generator';
import { colors, radius, space, type } from '../lib/theme';
import type { Exercise, Settings } from '../lib/types';
import { useFocusData } from '../lib/useData';
import { EXAMPLES, parseCommand } from '../lib/voice';
import { say } from '../services/speech';

interface CoachData {
  prefs: ExercisePrefs;
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  history: Awaited<ReturnType<typeof loadHistory>>;
  cardio: Awaited<ReturnType<typeof loadCardio>>;
  settings: Settings;
  activeId: number | null;
}

/** "Give me a 30 minute upper body workout with dumbbells" → a plan to start. */
export default function CoachScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [reply, setReply] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ workout: GeneratedWorkout; title: string; minutes: number } | null>(null);
  const [data] = useFocusData<CoachData>(async () => {
    const [exercises, history, cardio, settings, activeId, prefs] = await Promise.all([
      loadExercises(db),
      loadHistory(db, 30),
      loadCardio(db, 7),
      loadSettings(db),
      activeWorkoutId(db),
      loadPrefs(db),
    ]);
    return { exercises, byId: new Map(exercises.map((e) => [e.id, e])), history, cardio, settings, activeId, prefs };
  }, []);

  if (!data) return <Loading />;

  const respond = (line: string) => {
    setReply(line);
    say(line);
  };

  const run = (text: string) => {
    const cmd = parseCommand(text);
    if (cmd.kind !== 'workout') {
      respond('Tell me what to train, like “30 minute upper body with dumbbells”.');
      return;
    }
    const settings: Settings = {
      ...data.settings,
      minutes: cmd.minutes ?? data.settings.minutes,
      equipment: cmd.equipment ?? data.settings.equipment,
      goal: cmd.goal ?? data.settings.goal,
    };
    const workout = generateWorkout(data.exercises, data.history, settings, new Date(), cardioFatigue(data.cardio), cmd.focus, data.prefs);
    if (workout.exercises.length === 0) {
      setPlan(null);
      respond('I couldn’t find exercises for that equipment. Try another, or check your equipment in Settings.');
      return;
    }
    const title = cmd.label[0].toUpperCase() + cmd.label.slice(1);
    setPlan({ workout, title, minutes: settings.minutes });
    respond(`${title}, ${settings.minutes} minutes, ${workout.exercises.length} exercises. Starting with ${data.byId.get(workout.exercises[0].exerciseId)?.name ?? 'your first lift'}.`);
  };

  const start = async () => {
    if (!plan) return;
    await startWorkout(db, plan.workout.exercises);
    say('Let’s go.');
    router.replace('/workout');
  };

  const unit = data.settings.units;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <Text style={type.title}>Coach</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Icon name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {data.activeId != null ? (
        <View style={{ padding: space.md }}>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: space.md }]}>
            You have a workout in progress. Open it and tap the mic to log sets by voice.
          </Text>
          <Button title="Resume workout" onPress={() => router.replace('/workout')} />
        </View>
      ) : (
        <>
          <CoachBar reply={reply} examples={EXAMPLES.idle} placeholder="Say “quick leg day”" onSubmit={run} />
          {plan && (
            <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + 96 }}>
              <Text style={type.label}>{`${plan.minutes} MIN · ${plan.workout.exercises.length} EXERCISES`}</Text>
              <Text style={[type.title, { marginBottom: space.sm }]}>{plan.title}</Text>
              {plan.workout.exercises.map((p) => {
                const ex = data.byId.get(p.exerciseId);
                if (!ex) return null;
                return (
                  <View key={p.exerciseId} style={styles.row}>
                    <ExerciseThumb exercise={ex} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{ex.name}</Text>
                      <Text style={styles.meta}>
                        {`${p.sets} × ${p.targetReps}`}
                        {p.suggestedWeight != null ? ` · ${formatNumber(fromKg(p.suggestedWeight))} ${unit}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
          {plan && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
              <Button title="Start this workout" onPress={start} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    marginBottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
