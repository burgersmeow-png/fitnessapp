import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyMap, recoveryColor, recoveryFills } from '../../components/BodyMap';
import { CoachPlanCard } from '../../components/CoachPlanCard';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Icon, type IconName } from '../../components/Icon';
import { SectionLabel, Loading } from '../../components/ui';
import { CARDIO_BY_TYPE, cardioFatigue, type CardioSession } from '../../lib/cardio';
import { activeWorkoutId, loadCardio, loadExercises, loadFoodForDay, loadHistory, loadSettings, startWorkout } from '../../lib/db';
import { dailyTargets, sumMacros, type Macros } from '../../lib/nutrition';
import { formatNumber, MUSCLE_LABELS } from '../../lib/format';
import { generateWorkout, type GeneratedWorkout } from '../../lib/generator';
import { colors, radius, space, TAP, type } from '../../lib/theme';
import { ALL_MUSCLES, type Exercise, type Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';
import { syncStravaIfDue } from '../../services/strava';

interface TodayData {
  workout: GeneratedWorkout;
  exercises: Map<string, Exercise>;
  settings: Settings;
  activeId: number | null;
  weekSessions: number;
  lastCardio: CardioSession | null;
  eaten: Macros;
  targets: Macros;
}

const GOAL_LABEL = { strength: 'Strength', hypertrophy: 'Muscle', endurance: 'Endurance' };

export default function TodayScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  // Bumping the seed regenerates the plan with fresh history.
  const [seed, setSeed] = useState(0);
  const [data, reload] = useFocusData<TodayData>(async () => {
    const [exercises, history, settings, activeId, cardio, food] = await Promise.all([
      loadExercises(db),
      loadHistory(db, 30),
      loadSettings(db),
      activeWorkoutId(db),
      loadCardio(db, 7),
      loadFoodForDay(db, new Date()),
    ]);
    const weekAgo = Date.now() - 7 * 864e5;
    const weekSessions = new Set([
      ...history.filter((s) => new Date(s.completedAt).getTime() >= weekAgo).map((s) => s.completedAt.slice(0, 10)),
      ...cardio.map((c) => c.startedAt.slice(0, 10)),
    ]).size;
    // Leave out a different slice of the library each time the user asks for another plan.
    const rotated = seed === 0 ? exercises : exercises.filter((_, i) => (i + seed) % 4 !== 0);
    return {
      workout: generateWorkout(rotated, history, settings, new Date(), cardioFatigue(cardio)),
      exercises: new Map(exercises.map((e) => [e.id, e])),
      settings,
      activeId,
      weekSessions,
      lastCardio: cardio[0] ?? null,
      eaten: sumMacros(food),
      targets: dailyTargets(settings.bodyWeightKg, settings.nutritionGoal, settings.goal),
    };
  }, [seed]);

  // New Strava activities change recovery, so re-plan once they are in.
  useEffect(() => {
    syncStravaIfDue(db).then((added) => added > 0 && reload());
  }, [db, reload]);

  if (!data) return <Loading />;
  const { workout, exercises, settings, activeId, weekSessions, lastCardio } = data;
  const totalSets = workout.exercises.reduce((n, p) => n + p.sets, 0);
  const fresh = [...ALL_MUSCLES].sort((a, b) => workout.recovery[b] - workout.recovery[a]);

  const begin = async () => {
    if (activeId == null) await startWorkout(db, workout.exercises);
    router.push('/workout');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={type.label}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
      </Text>
      <Text style={[type.hero, { marginBottom: space.md }]}>Today</Text>

      <CoachPlanCard activeId={activeId} />

      <LinearGradient colors={['#FF6A2B', '#E5341B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>{activeId != null ? 'IN PROGRESS' : 'RECOMMENDED WORKOUT'}</Text>
            <Text style={styles.heroTitle}>{workout.focus.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(', ')}</Text>
          </View>
          <BodyMap
            height={118}
            skin="rgba(255,255,255,0.16)"
            idle="rgba(255,255,255,0.22)"
            fills={Object.fromEntries(workout.focus.map((m) => [m, { color: '#FFFFFF' }]))}
          />
        </View>
        <View style={styles.heroStats}>
          <HeroStat icon="time" value={`${settings.minutes} min`} />
          <HeroStat icon="barbell" value={`${workout.exercises.length} exercises`} />
          <HeroStat icon="sets" value={`${totalSets} sets`} />
          <HeroStat icon="goal" value={GOAL_LABEL[settings.goal]} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Pressable onPress={begin} accessibilityRole="button" style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]}>
            <Icon name="play" size={18} color={colors.accent} />
            <Text style={styles.heroButtonText}>{activeId != null ? 'Resume' : 'Start workout'}</Text>
          </Pressable>
          {activeId == null && (
            <Pressable
              onPress={() => router.push('/coach')}
              accessibilityRole="button"
              accessibilityLabel="Ask the coach for a workout"
              style={({ pressed }) => [styles.heroIconButton, pressed && { opacity: 0.7 }]}
            >
              <Icon name="mic" size={22} color="#FFFFFF" />
            </Pressable>
          )}
          {activeId == null && (
            <Pressable
              onPress={() => setSeed((s) => s + 1)}
              accessibilityRole="button"
              accessibilityLabel="Generate a different workout"
              style={({ pressed }) => [styles.heroIconButton, pressed && { opacity: 0.7 }]}
            >
              <Icon name="shuffle" size={22} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <SectionLabel>{`${workout.exercises.length} exercises`}</SectionLabel>
      {workout.exercises.map((p) => {
        const e = exercises.get(p.exerciseId)!;
        return (
          <Pressable key={p.exerciseId} accessibilityRole="button" accessibilityHint="Shows how to do it" onPress={() => router.push(`/exercise/${p.exerciseId}`)} style={styles.row}>
            <ExerciseThumb exercise={e} size={64} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={styles.rowTitle}>{e.name}</Text>
              <Text style={styles.rowMeta}>
                {p.sets} × {p.targetReps}
                {p.suggestedWeight != null ? ` · ${p.suggestedWeight} ${settings.units}` : e.equipment === 'bodyweight' ? ' · bodyweight' : ''}
                {p.suggestedWeight == null && e.equipment !== 'bodyweight' && <Text style={styles.rowNew}> · new lift</Text>}
              </Text>
              {p.deload ? (
                <Text style={[styles.badge, { color: colors.warning }]}>Deload: stalled lately, lighter today to rebound</Text>
              ) : p.change != null && p.change > 0 ? (
                <Text style={[styles.badge, { color: colors.success }]}>
                  ▲ {p.change} {settings.units} from last time
                </Text>
              ) : null}
            </View>
            <Icon name="chevron" size={16} color={colors.textMuted} />
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => router.push('/food')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cardioCard, { marginBottom: space.sm }, pressed && { opacity: 0.8 }]}
      >
        <View style={styles.cardioIcon}>
          <Icon name="food" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.rowTitle}>
            {formatNumber(data.eaten.calories)} / {formatNumber(data.targets.calories)} kcal
          </Text>
          <Text style={styles.rowMeta}>
            {data.eaten.calories === 0
              ? `Aim for ${data.targets.protein} g protein today. Snap your first meal.`
              : `${Math.round(data.eaten.protein)} of ${data.targets.protein} g protein`}
          </Text>
        </View>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </Pressable>

      <Pressable onPress={() => router.push('/cardio')} accessibilityRole="button" style={({ pressed }) => [styles.cardioCard, pressed && { opacity: 0.8 }]}>
        <View style={styles.cardioIcon}>
          <Icon name="pulse" size={24} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.rowTitle}>Log cardio</Text>
          <Text style={styles.rowMeta}>
            {lastCardio
              ? `Last: ${CARDIO_BY_TYPE.get(lastCardio.type)?.label} · ${Math.round(lastCardio.minutes)} min`
              : 'Runs, rides, rowing and intervals count toward recovery'}
          </Text>
        </View>
        <Icon name="add" size={28} color={colors.accent} />
      </Pressable>

      <SectionLabel>Muscle recovery</SectionLabel>
      <View style={styles.card}>
        <View style={{ alignItems: 'center' }}>
          <BodyMap
            fills={recoveryFills(workout.recovery)}
            height={230}
            label={recoveryLabel(workout.recovery)}
          />
          <View style={styles.sideLabels}>
            <Text style={type.label}>FRONT</Text>
            <Text style={type.label}>BACK</Text>
          </View>
        </View>
        <View style={styles.legend}>
          <Legend color={colors.success} label="Fresh" />
          <Legend color={colors.warning} label="Recovering" />
          <Legend color={colors.danger} label="Fatigued" />
        </View>
        <View style={styles.chips}>
          {fresh.map((m) => (
            <View key={m} style={styles.chip}>
              <View style={[styles.dot, { backgroundColor: recoveryColor(workout.recovery[m]) }]} />
              <Text style={styles.chipText}>
                {MUSCLE_LABELS[m]} {Math.round(workout.recovery[m] * 100)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, styles.weekCard]}>
        <Icon name="flame" size={28} color={colors.accent} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={styles.rowTitle}>
            {weekSessions} {weekSessions === 1 ? 'workout' : 'workouts'} this week
          </Text>
          <Text style={styles.rowMeta}>Recovery uses your last 72 hours of lifting and cardio.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function HeroStat({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Icon name={icon} size={14} color="rgba(255,255,255,0.85)" />
      <Text style={styles.heroStatText}>{value}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.rowMeta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, paddingBottom: space.xl * 2 },
  hero: { borderRadius: radius.lg, padding: space.lg },
  heroEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 6, lineHeight: 32 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroStatText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  heroButton: {
    flex: 1,
    height: TAP - 4,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroButtonText: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  heroIconButton: {
    width: TAP - 4,
    height: TAP - 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: space.sm,
  },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  rowNew: { color: colors.warning },
  badge: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  sideLabels: { flexDirection: 'row', justifyContent: 'space-around', width: 240, marginTop: space.xs },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
  },
  cardioIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,90,31,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCard: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
});

/** Spoken summary of the recovery map: the muscles that still need rest. */
function recoveryLabel(recovery: GeneratedWorkout['recovery']): string {
  const tired = ALL_MUSCLES.filter((m) => recovery[m] < 0.8)
    .sort((a, b) => recovery[a] - recovery[b])
    .map((m) => `${MUSCLE_LABELS[m]} ${Math.round(recovery[m] * 100)}%`);
  return tired.length ? `Muscle recovery. Still recovering: ${tired.join(', ')}` : 'Muscle recovery. Every muscle is fresh.';
}
