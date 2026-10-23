import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Button, Card } from '../components/ui';
import {
  activeWorkoutId,
  addSet,
  finishWorkout,
  loadExercises,
  loadHistory,
  loadSettings,
  loadWorkoutSets,
  updateSet,
  type WorkoutSet,
} from '../lib/db';
import { formatClock, formatNumber, MUSCLE_LABELS } from '../lib/format';
import { adjustNextSet, estimate1RM, personalRecords } from '../lib/progression';
import { colors, radius, space, TAP, type } from '../lib/theme';
import type { Exercise, Settings } from '../lib/types';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

interface Summary {
  sets: number;
  volume: number;
  minutes: number;
  prs: string[];
}

export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
  const [settings, setSettings] = useState<Settings | null>(null);
  // Best e1RM per exercise before this workout started, for PR detection.
  const [previousBest, setPreviousBest] = useState<Map<string, number>>(new Map());
  const [prSets, setPrSets] = useState<Set<number>>(new Set());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<Summary | null>(null);
  // A short note on the rest bar, e.g. when the next sets were auto-adjusted.
  const [restNote, setRestNote] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const reload = async (id: number) => setSets(await loadWorkoutSets(db, id));

  useEffect(() => {
    (async () => {
      const id = await activeWorkoutId(db);
      if (id == null) {
        close();
        return;
      }
      const [list, history, s] = await Promise.all([loadExercises(db), loadHistory(db), loadSettings(db)]);
      const workoutSets = await loadWorkoutSets(db, id);
      const thisWorkout = new Set(workoutSets.map((w) => w.completedAt).filter(Boolean));
      const prior = history.filter((h) => !thisWorkout.has(h.completedAt));
      setPreviousBest(new Map([...personalRecords(prior)].map(([k, v]) => [k, v.e1rm])));
      setExercises(new Map(list.map((e) => [e.id, e])));
      setSettings(s);
      setWorkoutId(id);
      setSets(workoutSets);
    })();
  }, [db]);

  // Rest timer tick.
  useEffect(() => {
    if (restEndsAt == null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= restEndsAt) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRestEndsAt(null);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [restEndsAt]);

  const groups = useMemo(() => {
    const out: { exerciseId: string; sets: WorkoutSet[] }[] = [];
    for (const s of sets) {
      const last = out.at(-1);
      if (last && last.exerciseId === s.exerciseId) last.sets.push(s);
      else out.push({ exerciseId: s.exerciseId, sets: [s] });
    }
    return out;
  }, [sets]);

  const done = sets.filter((s) => s.completedAt).length;

  const edit = (id: number, field: 'weight' | 'reps' | 'rir', value: number | null) => {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    updateSet(db, id, { [field]: value });
  };

  const toggle = async (set: WorkoutSet) => {
    if (set.completedAt) {
      await updateSet(db, set.id, { completedAt: null });
      setPrSets((prev) => {
        const next = new Set(prev);
        next.delete(set.id);
        return next;
      });
    } else {
      await updateSet(db, set.id, { completedAt: new Date().toISOString() });
      const e1rm = estimate1RM(set.weight ?? 0, set.reps ?? 0, set.rir);
      const best = previousBest.get(set.exerciseId) ?? 0;
      if (best > 0 && e1rm > best) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPrSets((prev) => new Set(prev).add(set.id));
        setPreviousBest((prev) => new Map(prev).set(set.exerciseId, e1rm));
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setRestNote(await autoAdjust(set));
      setRestEndsAt(Date.now() + set.restSeconds * 1000);
      setNow(Date.now());
    }
    await reload(workoutId!);
  };

  /**
   * Re-weights the remaining sets of this exercise from how the set just went.
   * Sets with no weight yet (a new lift) inherit the weight just used.
   */
  const autoAdjust = async (set: WorkoutSet): Promise<string | null> => {
    if (set.weight == null || set.reps == null) return null;
    const increment = settings?.units === 'kg' ? 2.5 : 5;
    const next =
      set.targetReps != null && set.targetRir != null
        ? adjustNextSet({ weight: set.weight, reps: set.reps, rir: set.rir }, set.targetReps, set.targetRir, increment)
        : null;
    // Only touch sets still at the planned weight (or empty), so manual edits stick.
    const later = sets.filter(
      (s) =>
        s.exerciseId === set.exerciseId &&
        s.position > set.position &&
        !s.completedAt &&
        (s.weight == null || s.weight === set.weight),
    );
    if (later.length === 0) return null;
    for (const s of later) await updateSet(db, s.id, { weight: next ?? set.weight });
    if (next == null) return null;
    const units = settings?.units ?? 'lb';
    return next > set.weight
      ? `That looked easy. Next sets bumped to ${next} ${units}.`
      : `That was tough. Next sets lowered to ${next} ${units}.`;
  };

  const finish = () => {
    const complete = async () => {
      const finished = sets.filter((s) => s.completedAt);
      const prNames = [...new Set(finished.filter((s) => prSets.has(s.id)).map((s) => exercises.get(s.exerciseId)?.name ?? ''))];
      await finishWorkout(db, workoutId!);
      if (finished.length === 0) {
        close();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSummary({
        sets: finished.length,
        volume: finished.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
        minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 6e4)),
        prs: prNames,
      });
    };
    const remaining = sets.length - done;
    if (remaining > 0 && Platform.OS === 'web') {
      // Alert.alert has no buttons on web, which is only used for previews.
      if (window.confirm(`Finish workout? ${remaining} unfinished sets will be dropped.`)) complete();
    } else if (remaining > 0) {
      Alert.alert('Finish workout?', `${remaining} unfinished sets will be dropped.`, [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Finish', onPress: complete },
      ]);
    } else {
      complete();
    }
  };

  if (summary) {
    // End on a high point: the summary leads with wins (peak-end rule).
    return (
      <View style={[styles.screen, styles.summary, { paddingTop: insets.top + space.xl }]}>
        <Text style={type.label}>WORKOUT COMPLETE</Text>
        <Text style={[type.hero, { marginTop: space.sm }]}>
          {summary.prs.length > 0 ? `${summary.prs.length} new PR${summary.prs.length > 1 ? 's' : ''}!` : 'Nice work.'}
        </Text>
        {summary.prs.map((name) => (
          <Text key={name} style={[type.body, { color: colors.success, marginTop: space.xs }]}>
            ★ {name}
          </Text>
        ))}
        <View style={styles.stats}>
          <Stat label="Sets" value={String(summary.sets)} />
          <Stat label={`Volume (${settings?.units})`} value={formatNumber(summary.volume)} />
          <Stat label="Minutes" value={String(summary.minutes)} />
        </View>
        <Button title="Done" onPress={() => close()} style={{ marginTop: 'auto', marginBottom: insets.bottom + space.md }} />
      </View>
    );
  }

  const restLeft = restEndsAt != null ? (restEndsAt - now) / 1000 : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => close()} hitSlop={12}>
          <Text style={styles.headerLink}>Minimize</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {done}/{sets.length} sets
        </Text>
        <Pressable onPress={finish} hitSlop={12}>
          <Text style={[styles.headerLink, { color: colors.accent, fontWeight: '700' }]}>Finish</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${sets.length ? (done / sets.length) * 100 : 0}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        {groups.map((g) => {
          const e = exercises.get(g.exerciseId);
          const left = g.sets.filter((s) => !s.completedAt).length;
          return (
            <Card key={`${g.exerciseId}-${g.sets[0].id}`} style={{ marginBottom: space.md }}>
              <Pressable onPress={() => router.push(`/exercise/${g.exerciseId}`)} style={styles.exHeader}>
                {e && <ExerciseThumb exercise={e} size={52} />}
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[type.title, { fontSize: 19 }]}>{e?.name}</Text>
                  <Text style={styles.meta}>{e?.primary.map((m) => MUSCLE_LABELS[m]).join(', ')}</Text>
                </View>
                {left === 0 && <Text style={styles.doneBadge}>✓</Text>}
              </Pressable>
              <Text style={[styles.meta, { marginBottom: space.sm }]}>
                {left > 0 ? `${left} to go` : 'All sets done'} · target {g.sets[0].targetReps} reps, {g.sets[0].targetRir} in reserve
              </Text>
              <View style={styles.columns}>
                <Text style={[styles.colLabel, { width: 28 }]}>SET</Text>
                <Text style={[styles.colLabel, { flex: 1 }]}>{settings?.units.toUpperCase()}</Text>
                <Text style={[styles.colLabel, { flex: 1 }]}>REPS</Text>
                <Text style={[styles.colLabel, { width: 52 }]}>RIR</Text>
                <View style={{ width: TAP }} />
              </View>
              {g.sets.map((s, i) => (
                <SetRow key={s.id} index={i + 1} set={s} pr={prSets.has(s.id)} onEdit={edit} onToggle={() => toggle(s)} />
              ))}
              <Pressable onPress={async () => {
                await addSet(db, workoutId!, g.sets.at(-1)!);
                await reload(workoutId!);
              }}>
                <Text style={styles.addSet}>+ Add set</Text>
              </Pressable>
            </Card>
          );
        })}
      </ScrollView>

      {restEndsAt != null && (
        <View style={[styles.rest, { paddingBottom: insets.bottom + space.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>REST</Text>
            <Text style={[type.number, { fontSize: 34 }]}>{formatClock(restLeft)}</Text>
            {restNote && (
              <Text style={[styles.restNote, !restNote.startsWith('That looked') && { color: colors.warning }]}>{restNote}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="+30s" variant="secondary" onPress={() => setRestEndsAt((t) => (t ?? Date.now()) + 30000)} />
            <Button title="Skip" onPress={() => setRestEndsAt(null)} />
          </View>
        </View>
      )}
    </View>
  );
}

function SetRow({
  index,
  set,
  pr,
  onEdit,
  onToggle,
}: {
  index: number;
  set: WorkoutSet;
  pr: boolean;
  onEdit: (id: number, field: 'weight' | 'reps' | 'rir', value: number | null) => void;
  onToggle: () => void;
}) {
  const done = !!set.completedAt;
  const parse = (t: string) => (t.trim() === '' || Number.isNaN(Number(t)) ? null : Number(t));
  const nextRir = () => onEdit(set.id, 'rir', set.rir == null ? set.targetRir : set.rir >= 4 ? 0 : set.rir + 1);
  return (
    <View style={styles.setRow}>
      <Text style={[styles.setIndex, pr && { color: colors.success }]}>{pr ? '★' : index}</Text>
      <TextInput
        style={[styles.input, done && styles.inputDone]}
        keyboardType="decimal-pad"
        defaultValue={set.weight != null ? String(set.weight) : ''}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        onChangeText={(t) => onEdit(set.id, 'weight', parse(t))}
        selectTextOnFocus
      />
      <TextInput
        style={[styles.input, done && styles.inputDone]}
        keyboardType="number-pad"
        defaultValue={set.reps != null ? String(set.reps) : ''}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        onChangeText={(t) => onEdit(set.id, 'reps', parse(t))}
        selectTextOnFocus
      />
      <Pressable onPress={nextRir} style={styles.rir} accessibilityLabel="Reps in reserve, tap to change">
        <Text style={styles.rirText}>{set.rir ?? '–'}</Text>
      </Pressable>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        style={[styles.check, done && { backgroundColor: pr ? colors.success : colors.accent, borderColor: 'transparent' }]}
      >
        <Text style={styles.checkText}>✓</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={type.number}>{value}</Text>
      <Text style={type.label}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  summary: { paddingHorizontal: space.lg },
  stats: { flexDirection: 'row', marginTop: space.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerLink: { color: colors.textMuted, fontSize: 17 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  progressTrack: { height: 4, backgroundColor: colors.surfaceRaised },
  progressFill: { height: 4, backgroundColor: colors.accent },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  doneBadge: { color: colors.success, fontSize: 22, fontWeight: '800' },
  columns: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  colLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  setIndex: { width: 28, textAlign: 'center', color: colors.textMuted, fontSize: 17, fontWeight: '700' },
  input: {
    flex: 1,
    // Web inputs have an intrinsic width that would push the row off screen.
    minWidth: 0,
    flexBasis: 0,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  inputDone: { backgroundColor: 'transparent', color: colors.textMuted },
  rir: {
    width: 52,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  check: {
    width: TAP,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  addSet: { color: colors.accent, fontSize: 16, fontWeight: '600', paddingVertical: space.sm, textAlign: 'center' },
  restNote: { color: colors.success, fontSize: 13, fontWeight: '600', marginTop: 2, marginRight: space.sm },
  rest: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
