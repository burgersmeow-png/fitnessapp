import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { Button, Card, Loading } from '../components/ui';
import { activeWorkoutId, loadExercises, loadHistory, loadSettings, startWorkout } from '../lib/db';
import { formatNumber } from '../lib/format';
import { colors, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { isSaved } from '../lib/savedWorkouts';
import { decodeWorkoutLink, encodeWorkoutLink, planFromLink } from '../lib/workoutLink';
import { forgetWorkout, keepWorkout, loadSaved } from '../services/savedWorkouts';

/** Opened from a shared workout link (liftlab://try?w=…). */
export default function TryWorkoutScreen() {
  const { w } = useLocalSearchParams<{ w?: string }>();
  const db = useSQLiteContext();
  const [data, reload] = useFocusData(async () => {
    const link = decodeWorkoutLink(w);
    if (!link) return { link: null } as const;
    const [exercises, history, settings, activeId, saved] = await Promise.all([loadExercises(db), loadHistory(db), loadSettings(db), activeWorkoutId(db), loadSaved(db)]);
    const { plan, missing } = planFromLink(link, exercises, history, settings.units === 'kg' ? 2.5 : 5);
    return { link, plan, missing, exercises: new Map(exercises.map((e) => [e.id, e])), units: settings.units, activeId, saved: isSaved(saved, link) };
  }, [w]);
  if (!data) return <Loading />;

  if (!data.link) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Icon name="exercises" size={56} color={colors.border} />
        <Text style={[type.title, { marginTop: space.md }]}>This link doesn’t work</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>It may have been cut off when it was copied. Ask for the link again.</Text>
        <Button title="Go to LiftLab" onPress={() => router.replace('/')} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
      </View>
    );
  }
  const { link, plan, missing, exercises, units, activeId, saved } = data;

  const toggleSaved = async () => {
    if (saved) await forgetWorkout(db, encodeWorkoutLink(link));
    else await keepWorkout(db, link);
    reload();
  };

  const start = async () => {
    await startWorkout(db, plan);
    router.replace('/workout');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Text style={type.label}>SHARED WORKOUT</Text>
      <Text style={[type.hero, { marginTop: space.xs }]}>{link.title}</Text>
      <Text style={styles.sub}>
        {plan.length} {plan.length === 1 ? 'lift' : 'lifts'} · {plan.reduce((n, p) => n + p.sets, 0)} sets. Weights are picked from your own history.
      </Text>

      {plan.length > 0 && (
        <Button
          title={activeId == null ? 'Start this workout' : 'Back to your current workout'}
          onPress={activeId == null ? start : () => router.replace('/workout')}
          style={{ marginTop: space.md }}
        />
      )}
      <Button
        title={saved ? 'Saved ✓ · tap to remove' : 'Save for later'}
        variant="secondary"
        onPress={toggleSaved}
        style={{ marginTop: space.sm, marginBottom: space.md }}
      />
      {activeId != null && <Text style={[styles.sub, { marginTop: 0, marginBottom: space.md }]}>Finish your current workout first, then open the link again.</Text>}

      {plan.map((p, i) => {
        const e = exercises.get(p.exerciseId);
        return (
          <Card key={`${p.exerciseId}-${i}`} style={styles.row}>
            {e && <ExerciseThumb exercise={e} size={44} />}
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={styles.name} numberOfLines={1}>{e?.name ?? p.exerciseId}</Text>
              <Text style={styles.meta}>
                {p.sets} × {p.targetReps}
                {p.suggestedWeight != null ? ` · ${formatNumber(p.suggestedWeight)} ${units}` : e?.equipment === 'bodyweight' ? ' · bodyweight' : ' · pick your weight'}
              </Text>
            </View>
          </Card>
        );
      })}
      {missing.length > 0 && (
        <Text style={styles.sub}>
          Skipped {missing.join(', ')}: {missing.length === 1 ? 'it’s a custom lift' : 'they’re custom lifts'} you don’t have. You can add {missing.length === 1 ? 'it' : 'them'} under Exercises.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, paddingVertical: space.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
