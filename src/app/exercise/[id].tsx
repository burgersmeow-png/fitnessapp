import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyMap, type MuscleFills } from '../../components/BodyMap';
import { ExerciseDemo } from '../../components/ExerciseDemo';
import { Button, Card, Chip, SectionLabel, Loading } from '../../components/ui';
import { confirm } from '../../components/confirm';
import { deleteCustomExercise, loadExercises, loadHistory, loadSettings } from '../../lib/db';
import { formatDate, MUSCLE_LABELS } from '../../lib/format';
import { EXERCISE_GUIDE } from '../../lib/exerciseGuide';
import { estimate1RM } from '../../lib/progression';
import { colors, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import { LiftNote } from '../../components/LiftNote';
import { loadNotes, saveNote } from '../../services/notes';
import { loadPrefs, savePref } from '../../services/exercisePrefs';
import type { ExercisePref } from '../../lib/exercisePrefs';

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [blocked, setBlocked] = useState(false);
  const [data, reload] = useFocusData(async () => {
    const [exercises, history, settings, notes, prefs] = await Promise.all([loadExercises(db), loadHistory(db), loadSettings(db), loadNotes(db), loadPrefs(db)]);
    const sets = history.filter((s) => s.exerciseId === id);
    // Best estimated 1RM per training day, oldest first.
    const byDay = new Map<string, { e1rm: number; weight: number; reps: number }>();
    for (const s of sets) {
      const day = s.completedAt.slice(0, 10);
      const e1rm = estimate1RM(s.weight, s.reps, s.rir);
      if (!byDay.has(day) || e1rm > byDay.get(day)!.e1rm) byDay.set(day, { e1rm, weight: s.weight, reps: s.reps });
    }
    const sessions = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
    return { exercise: exercises.find((e) => e.id === id), sessions, units: settings.units, note: notes[id], pref: prefs[id] ?? null };
  }, [id]);

  if (!data?.exercise) return <Loading />;
  const { exercise, sessions, units, note, pref } = data;
  const choose = async (p: ExercisePref) => {
    await savePref(db, exercise.id, pref === p ? null : p);
    reload();
  };
  const best = Math.max(0, ...sessions.map((s) => s.e1rm));
  const recent = sessions.slice(-12);
  const steps = EXERCISE_GUIDE[exercise.id] ?? [];
  const fills: MuscleFills = {};
  for (const m of exercise.secondary) fills[m] = { color: colors.accent, opacity: 0.4 };
  for (const m of exercise.primary) fills[m] = { color: colors.accent };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md }}>
      <Text style={type.hero}>{exercise.name}</Text>
      <Text style={[type.body, { color: colors.textMuted, marginTop: space.xs, textTransform: 'capitalize' }]}>
        {[...exercise.primary, ...exercise.secondary].map((m) => MUSCLE_LABELS[m]).join(', ')} · {exercise.equipment}
      </Text>
      <View style={styles.prefRow}>
        <Chip label="Suggest more" selected={pref === 'more'} onPress={() => choose('more')} />
        <Chip label="Don’t suggest" selected={pref === 'never'} onPress={() => choose('never')} />
      </View>
      {pref && (
        <Text style={styles.prefNote}>
          {pref === 'more'
            ? 'Planned workouts bring this lift back round sooner.'
            : 'Planned workouts leave this out. You can still add it to a workout yourself.'}
        </Text>
      )}

      <View style={{ marginTop: space.md }}>
        <LiftNote
          note={note}
          onSave={async (text) => {
            await saveNote(db, exercise.id, text);
            reload();
          }}
        />
        <ExerciseDemo exercise={exercise} />
      </View>

      {steps.length > 0 && <SectionLabel>How to do it</SectionLabel>}
      {steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={[type.body, { flex: 1, lineHeight: 22 }]}>{step}</Text>
        </View>
      ))}

      <SectionLabel>Muscles worked</SectionLabel>
      <Card style={{ alignItems: 'center' }}>
        <BodyMap
          fills={fills}
          height={200}
          label={`Works ${exercise.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}${exercise.secondary.length ? `, and helps ${exercise.secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}` : ''}`}
        />
        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.sm }}>
          <Text style={[type.label, { color: colors.accent }]}>● PRIMARY</Text>
          <Text style={[type.label, { color: colors.accent, opacity: 0.6 }]}>● SECONDARY</Text>
        </View>
      </Card>

      <SectionLabel>Estimated 1-rep max</SectionLabel>
      <Card>
        {sessions.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>Log this exercise to see your strength trend.</Text>
        ) : (
          <>
            <Text style={type.number}>
              {Math.round(best)} {units}
            </Text>
            <Text style={type.label}>ALL-TIME BEST</Text>
            <View style={styles.chart}>
              {recent.map((s) => (
                <View key={s.day} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(8, (s.e1rm / best) * 100)}%` },
                      s.e1rm === best && { backgroundColor: colors.success },
                    ]}
                  />
                </View>
              ))}
            </View>
            <Text style={[type.label, { marginTop: space.xs }]}>{recent.length === 1 ? 'FIRST SESSION' : `LAST ${recent.length} SESSIONS`}</Text>
          </>
        )}
      </Card>

      {sessions.length > 0 && <SectionLabel>Sessions</SectionLabel>}
      {[...sessions].reverse().map((s) => (
        <View key={s.day} style={styles.row}>
          <Text style={type.body}>{formatDate(s.day + 'T12:00:00')}</Text>
          <Text style={[type.body, { fontWeight: '700' }]}>
            {s.weight} × {s.reps}
          </Text>
        </View>
      ))}
      {exercise.custom && (
        <>
          <Button
            title="Delete exercise"
            variant="danger"
            style={{ marginTop: space.lg }}
            onPress={() =>
              confirm('Delete this exercise?', 'It comes out of your list and future plans.', 'Delete', async () => {
                if (await deleteCustomExercise(db, exercise.id)) router.back();
                else setBlocked(true);
              }, true)
            }
          />
          {blocked && (
            <Text style={{ color: colors.textMuted, marginTop: space.sm }}>
              You’ve logged sets of this lift, so it stays to keep your history whole.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md },
  prefNote: { color: colors.textMuted, fontSize: 14, marginTop: space.xs },
  screen: { flex: 1, backgroundColor: colors.background },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: space.md, gap: 6 },
  barSlot: { flex: 1, maxWidth: 28, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  step: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: colors.accentText, fontWeight: '800', fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
