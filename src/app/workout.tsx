import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { ProgressRing } from '../components/ProgressRing';
import { Button, Card } from '../components/ui';
import {
  activeWorkoutId,
  addSet,
  finishWorkout,
  toKg,
  loadExercises,
  loadHistory,
  loadSettings,
  loadWorkoutSets,
  saveSettings,
  updateSet,
  type WorkoutSet,
} from '../lib/db';
import { formatClock, formatNumber, MUSCLE_LABELS } from '../lib/format';
import { adjustNextSet, estimate1RM, personalRecords } from '../lib/progression';
import { colors, radius, space, TAP, type } from '../lib/theme';
import type { Exercise, Settings } from '../lib/types';
import { cancelRestAlert, scheduleRestAlert } from '../services/restAlert';
import { say } from '../services/speech';
import { EXAMPLES, parseCommand } from '../lib/voice';
import { CoachBar } from '../components/CoachBar';
import { StravaShare } from '../components/StravaShare';
import type { WorkoutForStrava } from '../lib/strava';
import { workoutTitle } from '../lib/social';
import { finishAssignedWorkout } from '../services/coaching';
import { finishProgramWorkout } from '../services/programs';
import { checkBadges, loadSessionDates, markBadgesSeen } from '../services/habits';
import { goalLine, weekProgress, type Badge, type WeekProgress } from '../lib/habits';
import { sharePost } from '../services/social';
import { Icon } from '../components/Icon';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

interface Summary {
  sets: number;
  volume: number;
  minutes: number;
  prs: string[];
  strava: WorkoutForStrava;
  week: WeekProgress;
  badges: Badge[];
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
  const nextUp = useRef('next set');
  // Once the lifter talks to the coach, the coach talks back, including when rest ends.
  const voiceMode = useRef(false);
  const restOverLine = useRef('');
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachReply, setCoachReply] = useState<string | null>(null);

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

  // Leaving the screen ends the rest, so the alert shouldn't fire later.
  useEffect(() => () => void cancelRestAlert(), []);

  // Rest timer tick. The end time is stored rather than a countdown, so the
  // timer is right again as soon as the app comes back from the background.
  useEffect(() => {
    if (restEndsAt == null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= restEndsAt) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRestEndsAt(null);
        if (voiceMode.current && restOverLine.current) say(restOverLine.current);
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
      startRest(set.restSeconds, set);
    }
    await reload(workoutId!);
  };

  /** Name of the exercise the lifter does next, for the rest alert. */
  const nextUpAfter = (set: WorkoutSet) => {
    const next = sets.find((s) => s.id !== set.id && !s.completedAt && s.position > set.position)
      ?? sets.find((s) => s.id !== set.id && !s.completedAt);
    return next ? exercises.get(next.exerciseId)?.name ?? 'next set' : 'wrap up and finish';
  };

  /** "Set 2 of Bench Press, 8 reps at 100 pounds" for the coach to read out. */
  const describe = (set: WorkoutSet) => {
    const ofExercise = sets.filter((s) => s.exerciseId === set.exerciseId);
    const n = ofExercise.findIndex((s) => s.id === set.id) + 1;
    const name = exercises.get(set.exerciseId)?.name ?? 'the next exercise';
    const load = set.weight != null ? ` at ${set.weight} ${settings?.units === 'kg' ? 'kilos' : 'pounds'}` : '';
    return `Set ${n} of ${name}, ${set.reps ?? set.targetReps ?? ''} reps${load}`;
  };

  const startRest = (seconds: number, set: WorkoutSet) => {
    setRestEndsAt(Date.now() + seconds * 1000);
    setNow(Date.now());
    const following = sets.find((s) => s.id !== set.id && !s.completedAt && s.position > set.position);
    restOverLine.current = following ? `Rest over. ${describe(following)}.` : 'Rest over. That was the last set. Nice work.';
    nextUp.current = nextUpAfter(set);
    scheduleRestAlert(seconds, nextUp.current);
  };

  const extendRest = (seconds = 30) => {
    const endsAt = (restEndsAt ?? Date.now()) + seconds * 1000;
    setRestEndsAt(endsAt);
    scheduleRestAlert((endsAt - Date.now()) / 1000, nextUp.current);
  };

  const skipRest = () => {
    setRestEndsAt(null);
    cancelRestAlert();
  };

  /** Runs one dictated command against the current set. */
  const runCommand = async (text: string) => {
    voiceMode.current = true;
    const cmd = parseCommand(text);
    const current = sets.find((s) => !s.completedAt);
    let reply: string;
    if (cmd.kind === 'log') {
      if (!current) {
        reply = 'All sets are done. Say finish workout when you are ready.';
      } else {
        // A weight said in the other unit is converted to the one on screen.
        const units = settings?.units ?? 'lb';
        let weight = cmd.weight ?? current.weight;
        if (cmd.weight != null && cmd.unit && cmd.unit !== units) {
          const kg = cmd.unit === 'kg' ? cmd.weight : cmd.weight / 2.20462262;
          weight = Math.round((units === 'kg' ? kg : kg * 2.20462262) * 10) / 10;
        }
        const logged = { ...current, weight, reps: cmd.reps ?? current.reps ?? current.targetReps, rir: cmd.rir ?? current.rir ?? current.targetRir };
        await updateSet(db, current.id, { weight: logged.weight, reps: logged.reps, rir: logged.rir });
        setSets((prev) => prev.map((s) => (s.id === logged.id ? logged : s)));
        await toggle(logged);
        const following = sets.find((s) => s.id !== logged.id && !s.completedAt && s.position > logged.position);
        reply = `Logged ${logged.reps} reps${logged.weight != null ? ` at ${logged.weight}` : ''}.${
          following ? ` Rest ${Math.round(logged.restSeconds / 15) * 15} seconds.` : ' That was the last set.'
        }`;
      }
    } else if (cmd.kind === 'skipRest') {
      skipRest();
      reply = current ? `Let's go. ${describe(current)}.` : 'All sets are done.';
    } else if (cmd.kind === 'addRest') {
      extendRest(cmd.seconds);
      reply = `Added ${cmd.seconds >= 60 ? `${cmd.seconds / 60} minute${cmd.seconds > 60 ? 's' : ''}` : `${cmd.seconds} seconds`}.`;
    } else if (cmd.kind === 'next') {
      const left = sets.filter((s) => !s.completedAt).length;
      reply = current ? `${describe(current)}. ${left} set${left === 1 ? '' : 's'} left.` : 'All sets are done.';
    } else if (cmd.kind === 'finish') {
      reply = 'Finishing your workout.';
      finish();
    } else {
      reply = `Sorry, I didn't catch that. Try "${EXAMPLES.workout[0]}".`;
    }
    setCoachReply(reply);
    say(reply);
  };

  /** Copies the previous set's weight and reps into this one: the most common edit. */
  const copyPrevious = (set: WorkoutSet, previous: WorkoutSet | undefined) => {
    if (!previous || set.completedAt) return;
    Haptics.selectionAsync();
    setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, weight: previous.weight, reps: previous.reps } : s)));
    updateSet(db, set.id, { weight: previous.weight, reps: previous.reps });
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

  const toggleUnits = async () => {
    if (!settings || workoutId == null) return;
    const next = { ...settings, units: settings.units === 'kg' ? ('lb' as const) : ('kg' as const) };
    await saveSettings(db, next);
    setSettings(next);
    // Personal bests are compared in display units, so convert them too.
    const factor = next.units === 'lb' ? 2.20462262 : 1 / 2.20462262;
    setPreviousBest((prev) => new Map([...prev].map(([k, v]) => [k, v * factor])));
    await reload(workoutId);
  };

  const finish = () => {
    const complete = async () => {
      const finished = sets.filter((s) => s.completedAt);
      const prNames = [...new Set(finished.filter((s) => prSets.has(s.id)).map((s) => exercises.get(s.exerciseId)?.name ?? ''))];
      await finishWorkout(db, workoutId!);
      if (finished.length > 0) finishAssignedWorkout(db, workoutId!).catch(() => {});
      if (finished.length > 0) await finishProgramWorkout(db, workoutId!);
      skipRest();
      if (finished.length === 0) {
        close();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const goal = settings?.weeklyGoal ?? 3;
      const [badges, dates] = await Promise.all([checkBadges(db, goal), loadSessionDates(db)]);
      // Celebrated here, so Today doesn't repeat them.
      if (badges.fresh.length) markBadgesSeen(db);
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 6e4));
      // Per exercise, in workout order: set count and the best set by estimated 1RM.
      const byExercise = new Map<string, typeof finished>();
      for (const s of finished) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
      const strength = (s: (typeof finished)[number]) => (s.weight && s.reps ? estimate1RM(s.weight, s.reps) : s.reps ?? 0);
      setSummary({
        sets: finished.length,
        volume: finished.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
        minutes,
        prs: prNames,
        week: weekProgress(dates, goal),
        badges: badges.fresh,
        strava: {
          startedAt: new Date(startedAt.current).toISOString(),
          minutes,
          units: settings?.units ?? 'lb',
          prs: prNames,
          exercises: [...byExercise].map(([id, list]) => {
            const best = list.reduce((a, b) => (strength(b) > strength(a) ? b : a));
            return { name: exercises.get(id)?.name ?? id, sets: list.length, best: { weight: best.weight, reps: best.reps } };
          }),
        },
      });
      // With friend sharing off, sessions still reach a coach if there is one.
      if (settings) {
        const started = new Date(startedAt.current).toISOString();
        // Ordered by sets, so the title names what was trained most.
        const muscles = [...byExercise]
          .sort((a, b) => b[1].length - a[1].length)
          .flatMap(([id]) => (exercises.get(id)?.primary ?? []).map((m) => MUSCLE_LABELS[m]));
        sharePost(db, {
          clientId: `workout:${workoutId}`,
          kind: 'workout',
          visibility: settings?.shareWithFriends === false ? 'coach' : 'friends',
          title: workoutTitle(started, muscles),
          happenedAt: started,
          body: {
            minutes,
            sets: finished.length,
            volumeKg: Math.round(finished.reduce((sum, s) => sum + toKg(s.weight ?? 0) * (s.reps ?? 0), 0)),
            prs: prNames,
            exercises: [...byExercise].map(([id, list]) => {
              const best = list.reduce((a, b) => (strength(b) > strength(a) ? b : a));
              return {
                name: exercises.get(id)?.name ?? id,
                sets: list.length,
                bestKg: best.weight != null ? Math.round(toKg(best.weight) * 10) / 10 : null,
                bestReps: best.reps,
              };
            }),
          },
        }).catch(() => {});
      }
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
        <View style={styles.goalRow}>
          <ProgressRing done={summary.week.done} total={summary.week.goal} size={56} stroke={5} what="training days" />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.goalTitle}>
              {summary.week.streak > 1 ? `${summary.week.streak}-week streak` : summary.week.done >= summary.week.goal ? 'Weekly goal hit' : 'Weekly goal'}
            </Text>
            <Text style={styles.goalMeta}>{goalLine(summary.week)}</Text>
          </View>
        </View>
        {summary.badges.slice(0, 2).map((b) => (
          <View key={b.id} style={styles.badgeRow}>
            <View style={styles.badgeIcon}>
              <Icon name={b.icon} size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={styles.badgeEyebrow}>NEW BADGE</Text>
              <Text style={styles.goalTitle}>{b.title}</Text>
            </View>
          </View>
        ))}
        {summary.badges.length > 2 && (
          <Text style={[styles.goalMeta, { marginTop: space.sm }]}>{`+${summary.badges.length - 2} more in Badges`}</Text>
        )}
        <StravaShare workout={summary.strava} />
        <Button title="Done" onPress={() => close()} style={{ marginTop: 'auto', marginBottom: insets.bottom + space.md }} />
      </View>
    );
  }

  const restLeft = restEndsAt != null ? (restEndsAt - now) / 1000 : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => close()} hitSlop={12} accessibilityRole="button" accessibilityHint="Keeps the workout running">
          <Text style={styles.headerLink}>Minimize</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <ProgressRing done={done} total={sets.length} />
          <Pressable
            onPress={() => setCoachOpen((o) => !o)}
            hitSlop={10}
            style={[styles.coachButton, coachOpen && { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Talk to the coach"
            accessibilityHint="Log sets and control rest by voice"
          >
            <Icon name="mic" size={18} color={coachOpen ? colors.accentText : colors.text} />
          </Pressable>
        </View>
        <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Finish workout">
          <Text style={[styles.headerLink, { color: colors.accent, fontWeight: '700' }]}>Finish</Text>
        </Pressable>
      </View>

      {coachOpen && <CoachBar reply={coachReply} examples={EXAMPLES.workout} placeholder="Say “8 reps at 100”" onSubmit={runCommand} />}

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
        {groups.map((g) => {
          const e = exercises.get(g.exerciseId);
          const left = g.sets.filter((s) => !s.completedAt).length;
          return (
            <Card key={`${g.exerciseId}-${g.sets[0].id}`} style={{ marginBottom: space.md }}>
              <Pressable
                onPress={() => router.push(`/exercise/${g.exerciseId}`)}
                style={styles.exHeader}
                accessibilityRole="button"
                accessibilityHint="Shows how to do it"
              >
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
                <Pressable onPress={toggleUnits} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Switch between kilograms and pounds">
                  <Text style={[styles.colLabel, { color: colors.accent }]}>{settings?.units.toUpperCase()} ⇄</Text>
                </Pressable>
                <Text style={[styles.colLabel, { flex: 1 }]}>REPS</Text>
                <Text style={[styles.colLabel, { width: 52 }]}>RIR</Text>
                <View style={{ width: TAP }} />
              </View>
              {g.sets.map((s, i) => (
                <SetRow
                  key={s.id}
                  index={i + 1}
                  set={s}
                  units={settings?.units ?? 'lb'}
                  pr={prSets.has(s.id)}
                  onEdit={edit}
                  onToggle={() => toggle(s)}
                  onCopyPrevious={i > 0 ? () => copyPrevious(s, g.sets[i - 1]) : undefined}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add a set of ${e?.name ?? 'this exercise'}`}
                onPress={async () => {
                  await addSet(db, workoutId!, g.sets.at(-1)!);
                  await reload(workoutId!);
                }}
              >
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
            <Text
              style={[type.number, { fontSize: 34 }]}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel={`Rest, ${Math.ceil(restLeft)} seconds left`}
            >
              {formatClock(restLeft)}
            </Text>
            {restNote && (
              <Text style={[styles.restNote, !restNote.startsWith('That looked') && { color: colors.warning }]}>{restNote}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="+30s" variant="secondary" onPress={() => extendRest()} />
            <Button title="Skip" onPress={skipRest} />
          </View>
        </View>
      )}
    </View>
  );
}

function SetRow({
  index,
  set,
  units,
  pr,
  onEdit,
  onToggle,
  onCopyPrevious,
}: {
  index: number;
  set: WorkoutSet;
  units: string;
  pr: boolean;
  onEdit: (id: number, field: 'weight' | 'reps' | 'rir', value: number | null) => void;
  onToggle: () => void;
  onCopyPrevious?: () => void;
}) {
  const done = !!set.completedAt;
  const parse = (t: string) => (t.trim() === '' || Number.isNaN(Number(t)) ? null : Number(t));
  const show = (n: number | null) => (n != null ? String(n) : '');
  // Controlled text, re-synced when the value changes from outside
  // (auto-adjusted weights, or a kg/lb switch), without fighting the user's typing.
  const [weightText, setWeightText] = useState(show(set.weight));
  const [repsText, setRepsText] = useState(show(set.reps));
  useEffect(() => {
    if (parse(weightText) !== set.weight) setWeightText(show(set.weight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight]);
  useEffect(() => {
    if (parse(repsText) !== set.reps) setRepsText(show(set.reps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.reps]);
  const nextRir = () => onEdit(set.id, 'rir', set.rir == null ? set.targetRir : set.rir >= 4 ? 0 : set.rir + 1);
  return (
    <View style={styles.setRow}>
      <Pressable
        onPress={onCopyPrevious}
        disabled={!onCopyPrevious || done}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Set ${index}${pr ? ', personal record' : ''}`}
        accessibilityHint={onCopyPrevious && !done ? 'Copies weight and reps from the set above' : undefined}
      >
        <Text style={[styles.setIndex, pr && { color: colors.success }]} maxFontSizeMultiplier={1.3}>
          {pr ? '★' : index}
        </Text>
      </Pressable>
      <TextInput
        style={[styles.input, done && styles.inputDone]}
        keyboardType="decimal-pad"
        accessibilityLabel={`Set ${index} weight in ${units}`}
        maxFontSizeMultiplier={1.3}
        value={weightText}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        onChangeText={(t) => {
          setWeightText(t);
          onEdit(set.id, 'weight', parse(t));
        }}
        selectTextOnFocus
      />
      <TextInput
        style={[styles.input, done && styles.inputDone]}
        keyboardType="number-pad"
        accessibilityLabel={`Set ${index} reps`}
        maxFontSizeMultiplier={1.3}
        value={repsText}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        onChangeText={(t) => {
          setRepsText(t);
          onEdit(set.id, 'reps', parse(t));
        }}
        selectTextOnFocus
      />
      <Pressable
        onPress={nextRir}
        style={styles.rir}
        accessibilityRole="button"
        accessibilityLabel={`Set ${index} reps in reserve: ${set.rir ?? 'not set'}`}
        accessibilityHint="Tap to change"
      >
        <Text style={styles.rirText}>{set.rir ?? '–'}</Text>
      </Pressable>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityLabel={`Complete set ${index}`}
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
  goalRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  goalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  goalMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,181,61,0.1)',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,181,61,0.16)' },
  badgeEyebrow: { color: colors.warning, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerLink: { color: colors.textMuted, fontSize: 17 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  coachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    minHeight: 48,
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
