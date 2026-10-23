import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../../components/confirm';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Button, Card, Loading } from '../../components/ui';
import {
  activeWorkoutId,
  deleteWorkout,
  loadExercises,
  loadHistory,
  loadSettings,
  loadWorkout,
  loadWorkoutSets,
  startWorkout,
} from '../../lib/db';
import { formatDate, formatDuration, formatNumber } from '../../lib/format';
import { estimate1RM } from '../../lib/progression';
import { groupSets, repeatPlan } from '../../lib/repeat';
import { linkFromSets, type WorkoutLink } from '../../lib/workoutLink';
import { prHistory } from '../../lib/records';
import { cardContent, type CardContent } from '../../lib/shareCard';
import { ShareCardSheet } from '../../components/ShareCardSheet';
import { WorkoutLinkSheet } from '../../components/WorkoutLinkSheet';
import { colors, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [card, setCard] = useState<CardContent | null>(null);
  const [link, setLink] = useState<WorkoutLink | null>(null);
  const [data] = useFocusData(async () => {
    const workoutId = Number(id);
    const [workout, sets, exercises, settings, history, activeId] = await Promise.all([
      loadWorkout(db, workoutId),
      loadWorkoutSets(db, workoutId),
      loadExercises(db),
      loadSettings(db),
      loadHistory(db),
      activeWorkoutId(db),
    ]);
    return { workout, sets, exercises: new Map(exercises.map((e) => [e.id, e])), settings, history, activeId };
  }, [id]);

  if (!data) return <Loading />;
  const { workout, sets, exercises, settings, history, activeId } = data;
  if (!workout) {
    return (
      <View style={[styles.screen, { padding: space.md }]}>
        <Text style={type.body}>This workout was deleted.</Text>
      </View>
    );
  }
  const units = settings.units;
  const volume = sets.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0);

  const again = async () => {
    if (activeId == null) {
      await startWorkout(db, repeatPlan(sets, history, units === 'kg' ? 2.5 : 5));
    }
    router.replace('/workout');
  };

  const share = () => {
    const ids = new Set(sets.map((s) => s.completedAt));
    const prs = prHistory(history, 1000)
      .filter((p) => ids.has(p.at))
      .map((p) => exercises.get(p.exerciseId)?.name ?? p.exerciseId);
    const lifts = groupSets(sets).map((g) => {
      const best = [...g.sets].sort((a, b) => estimate1RM(b.weight ?? 0, b.reps ?? 0, b.rir) - estimate1RM(a.weight ?? 0, a.reps ?? 0, a.rir))[0];
      return { name: exercises.get(g.exerciseId)?.name ?? g.exerciseId, sets: g.sets.length, best: { weight: best.weight, reps: best.reps } };
    });
    const minutes = workout.finishedAt ? Math.max(1, Math.round((Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 6e4)) : 0;
    setCard(cardContent({ startedAt: workout.startedAt, minutes, sets: sets.length, volume, units, prs: [...new Set(prs)], exercises: lifts }));
  };

  const remove = () =>
    confirm('Delete this workout?', 'Its sets come out of your history, charts and PRs. This can’t be undone.', 'Delete', async () => {
      await deleteWorkout(db, workout.id);
      router.back();
    }, true);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Text style={type.hero}>{formatDate(workout.startedAt)}</Text>
      <Text style={styles.sub}>
        {workout.finishedAt ? `${formatDuration(workout.startedAt, workout.finishedAt)} · ` : ''}
        {sets.length} {sets.length === 1 ? 'set' : 'sets'} · {formatNumber(volume)} {units} volume
      </Text>

      <Button
        title={activeId == null ? 'Do this workout again' : 'Back to your current workout'}
        onPress={activeId == null ? again : () => router.push('/workout')}
        style={{ marginVertical: space.md }}
      />
      <Text style={[styles.sub, { marginTop: 0, marginBottom: space.md }]}>
        {activeId == null
          ? 'Same lifts, sets and reps, with today’s weights from your progress.'
          : 'You have a workout going. Finish it, then you can do this one again.'}
      </Text>
      <View style={styles.shareRow}>
        <Button title="Share to your story" variant="secondary" onPress={share} style={{ flex: 1 }} />
        <Button
          title="Share as a link"
          variant="secondary"
          onPress={() => setLink(linkFromSets('', sets, (eid) => exercises.get(eid)?.name ?? eid))}
          style={{ flex: 1 }}
        />
      </View>

      {groupSets(sets).map((g, gi) => {
        const e = exercises.get(g.exerciseId);
        const best = Math.max(...g.sets.map((s) => estimate1RM(s.weight ?? 0, s.reps ?? 0, s.rir)));
        return (
          <Card key={`${g.exerciseId}-${gi}`} style={{ marginBottom: space.md }}>
            <View style={styles.head}>
              {e && <ExerciseThumb exercise={e} size={44} />}
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={[type.title, { fontSize: 18 }]}>{e?.name ?? g.exerciseId}</Text>
                {best > 0 && <Text style={styles.meta}>Best estimated max {formatNumber(Math.round(best))} {units}</Text>}
              </View>
            </View>
            {g.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setNum}>{i + 1}</Text>
                <Text style={styles.setText}>
                  {s.weight ? `${formatNumber(s.weight)} ${units} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`}
                </Text>
                {s.rir != null && <Text style={styles.meta}>{s.rir} in reserve</Text>}
              </View>
            ))}
          </Card>
        );
      })}

      <ShareCardSheet content={card} onClose={() => setCard(null)} />
      <WorkoutLinkSheet link={link} onClose={() => setLink(null)} />
      <Button title="Delete workout" variant="danger" onPress={remove} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shareRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  screen: { flex: 1, backgroundColor: colors.background },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  setNum: { width: 24, color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  setText: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
