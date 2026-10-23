import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BodyMap, recoveryColor, recoveryFills } from '../../components/BodyMap';
import { CoachPlanCard } from '../../components/CoachPlanCard';
import { CreatorFeedCard } from '../../components/CreatorFeedCard';
import { CrewCard } from '../../components/CrewCard';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { GoalCard } from '../../components/GoalCard';
import { ProgressRing } from '../../components/ProgressRing';
import { Icon, type IconName } from '../../components/Icon';
import { Chip, SectionLabel, Loading } from '../../components/ui';
import { CARDIO_BY_TYPE, cardioFatigue, type CardioSession } from '../../lib/cardio';
import { flushCreator } from '../../services/creatorCode';
import { activeWorkoutId, loadCardio, loadExercises, loadFoodForDay, loadHistory, loadSettings, startWorkout } from '../../lib/db';
import { dailyTargets, sumMacros, type Macros } from '../../lib/nutrition';
import { formatNumber, MUSCLE_LABELS } from '../../lib/format';
import { generateWorkout, type GeneratedWorkout } from '../../lib/generator';
import { needsOnboarding } from '../../lib/onboarding';
import { deloadWorkout, programStep, type ProgramStep } from '../../lib/programs';
import { weekProgress, type Badge, type WeekProgress } from '../../lib/habits';
import { colors, radius, space, TAP, type } from '../../lib/theme';
import { ALL_MUSCLES, type Exercise, type PlannedExercise, type Settings } from '../../lib/types';
import { useFocusData } from '../../lib/useData';
import { checkBadges, loadSessionDates } from '../../services/habits';
import { loadProgram, rememberProgramWorkout } from '../../services/programs';
import { loadSaved } from '../../services/savedWorkouts';
import { loadPlan, rememberPlanWorkout } from '../../services/plan';
import type { FollowedPlan } from '../../lib/planLink';
import { planFromLink } from '../../lib/workoutLink';
import { loadChallenge } from '../../services/challenge';
import { challengeProgress, type ChallengeProgress, type JoinedChallenge } from '../../lib/challenge';
import { syncRecapNudge, syncReminders } from '../../services/reminders';
import { loadGyms, saveGyms } from '../../services/gyms';
import { switchGym, type Gyms } from '../../lib/gyms';
import { syncStravaIfDue } from '../../services/strava';

interface TodayData {
  workout: GeneratedWorkout;
  exercises: Map<string, Exercise>;
  settings: Settings;
  activeId: number | null;
  week: WeekProgress;
  freshBadges: Badge[];
  step: ProgramStep | null;
  onboard: boolean;
  lastCardio: CardioSession | null;
  eaten: Macros;
  targets: Macros;
  savedCount: number;
  plan: { followed: FollowedPlan; next: PlannedExercise[] } | null;
  challenge: { def: JoinedChallenge; progress: ChallengeProgress } | null;
  gyms: Gyms;
}

const GOAL_LABEL = { strength: 'Strength', hypertrophy: 'Muscle', endurance: 'Endurance' };

export default function TodayScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  // Bumping the seed regenerates the plan with fresh history.
  const [seed, setSeed] = useState(0);
  const [data, reload] = useFocusData<TodayData>(async () => {
    const [exercises, history, settings, activeId, cardio, food, sessionDates, program, saved, challenge, plan] = await Promise.all([
      loadExercises(db),
      loadHistory(db, 30),
      loadSettings(db),
      activeWorkoutId(db),
      loadCardio(db, 7),
      loadFoodForDay(db, new Date()),
      loadSessionDates(db),
      loadProgram(db),
      loadSaved(db),
      loadChallenge(db),
      loadPlan(db),
    ]);
    const [badges, gyms] = await Promise.all([checkBadges(db, settings.weeklyGoal), loadGyms(db)]);
    // Re-plan reminders whenever Today opens, so they reflect what's been done.
    syncReminders(db, settings);
    syncRecapNudge(db);
    // Leave out a different slice of the library each time the user asks for another plan.
    const rotated = seed === 0 ? exercises : exercises.filter((_, i) => (i + seed) % 4 !== 0);
    // A program decides what to train today; recovery and progression still pick the lifts.
    const step = program ? programStep(program) : null;
    const following = step && !step.finished ? step : null;
    const planned = generateWorkout(rotated, history, settings, new Date(), cardioFatigue(cardio), following?.day.focus);
    return {
      workout: following?.deload ? deloadWorkout(planned, settings.units === 'kg' ? 2.5 : 5) : planned,
      step,
      onboard: needsOnboarding(settings, sessionDates.length > 0),
      exercises: new Map(exercises.map((e) => [e.id, e])),
      settings,
      activeId,
      week: weekProgress(sessionDates, settings.weeklyGoal),
      freshBadges: badges.fresh,
      lastCardio: cardio[0] ?? null,
      eaten: sumMacros(food),
      targets: dailyTargets(settings.bodyWeightKg, settings.nutritionGoal, settings.goal),
      savedCount: saved.length,
      plan: plan
        ? { followed: plan, next: planFromLink(plan.days[plan.next], exercises, history, settings.units === 'kg' ? 2.5 : 5).plan }
        : null,
      challenge: challenge ? { def: challenge, progress: challengeProgress(challenge, sessionDates, new Date()) } : null,
      gyms,
    };
  }, [seed]);

  // New Strava activities change recovery, so re-plan once they are in.
  useEffect(() => {
    syncStravaIfDue(db).then((added) => added > 0 && reload());
    flushCreator(db).catch(() => {});
  }, [db, reload]);

  if (!data) return <Loading />;
  if (data.onboard) return <Redirect href="/welcome" />;
  const { workout, exercises, settings, activeId, lastCardio } = data;
  const totalSets = workout.exercises.reduce((n, p) => n + p.sets, 0);
  const following = data.step && !data.step.finished ? data.step : null;
  const fresh = [...ALL_MUSCLES].sort((a, b) => workout.recovery[b] - workout.recovery[a]);

  const beginPlan = async () => {
    if (activeId == null && data.plan) {
      const id = await startWorkout(db, data.plan.next);
      await rememberPlanWorkout(db, id);
    }
    router.push('/workout');
  };

  const begin = async () => {
    if (activeId == null) {
      const id = await startWorkout(db, workout.exercises);
      if (following) await rememberProgramWorkout(db, id);
    }
    router.push('/workout');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={type.label}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
      </Text>
      <Text style={[type.hero, { marginBottom: space.md }]}>Today</Text>

      <GoalCard progress={data.week} fresh={data.freshBadges} />

      {data.plan && (
        <View style={styles.planCard}>
          <Pressable onPress={() => router.push('/plan')} accessibilityRole="button" accessibilityHint="Shows the whole plan">
            <Text style={styles.planEyebrow}>{data.plan.followed.title.toUpperCase()}</Text>
            <Text style={styles.planTitle}>
              Up next: {data.plan.followed.days[data.plan.followed.next].title}
            </Text>
            <Text style={styles.rowMeta}>
              Day {data.plan.followed.next + 1} of {data.plan.followed.days.length} · {data.plan.next.length}{' '}
              {data.plan.next.length === 1 ? 'lift' : 'lifts'} · {data.plan.next.reduce((n, p) => n + p.sets, 0)} sets
            </Text>
          </Pressable>
          <Pressable
            onPress={beginPlan}
            accessibilityRole="button"
            style={({ pressed }) => [styles.planStart, pressed && { opacity: 0.85 }]}
          >
            <Icon name="play" size={18} color={colors.accentText} />
            <Text style={styles.planStartText}>{activeId != null ? 'Resume workout' : 'Start'}</Text>
          </Pressable>
        </View>
      )}

      <CoachPlanCard activeId={activeId} />
      <CreatorFeedCard />

      {data.gyms.list.length > 1 && activeId == null && (
        <View style={styles.gymRow}>
          <Text style={styles.gymLabel}>TRAINING AT</Text>
          {data.gyms.list.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={g.id === data.gyms.active}
              onPress={async () => {
                if (g.id === data.gyms.active) return;
                await saveGyms(db, switchGym(data.gyms, g.id));
                reload();
              }}
            />
          ))}
        </View>
      )}

      <LinearGradient colors={['#FF6A2B', '#E5341B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>
              {activeId != null
                ? 'IN PROGRESS'
                : following
                  ? `${following.program.name.toUpperCase()} · WEEK ${following.week}${following.deload ? ' · DELOAD' : ''}`
                  : data.plan
                    ? 'OR TRAIN WHAT’S RECOVERED'
                    : 'RECOMMENDED WORKOUT'}
            </Text>
            <Text style={styles.heroTitle}>{following && activeId == null ? following.day.name : workout.focus.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(', ')}</Text>
            {following && activeId == null && (
              <Text style={styles.heroSub}>
                {following.deload ? 'Lighter on purpose this week. ' : ''}
                {workout.focus.slice(0, 3).map((m) => MUSCLE_LABELS[m]).join(', ')}
              </Text>
            )}
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
        onPress={() => router.push('/programs')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cardioCard, { marginBottom: space.sm }, pressed && { opacity: 0.8 }]}
      >
        <View style={styles.cardioIcon}>
          <Icon name="calendar" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.rowTitle}>{data.step ? data.step.program.name : 'Follow a program'}</Text>
          <Text style={styles.rowMeta}>
            {!data.step
              ? 'Full Body, Upper / Lower, Push Pull Legs and more'
              : data.step.finished
                ? 'Program complete! Pick your next one.'
                : `Week ${data.step.week} of ${data.step.program.weeks} · day ${data.step.dayOfWeek} of ${data.step.program.daysPerWeek}`}
          </Text>
          {following && (
            <View style={styles.programTrack}>
              <View style={[styles.programFill, { width: `${Math.round(following.progress * 100)}%` }]} />
            </View>
          )}
        </View>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </Pressable>

      <CrewCard />
      <Pressable
        onPress={() => router.push('/challenge')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cardioCard, { marginBottom: space.sm }, pressed && { opacity: 0.8 }]}
      >
        {data.challenge ? (
          <ProgressRing done={data.challenge.progress.done} total={data.challenge.def.sessions} size={48} stroke={4} what="challenge sessions" />
        ) : (
          <View style={styles.cardioIcon}>
            <Icon name="flame" size={22} color={colors.accent} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.rowTitle}>{data.challenge ? data.challenge.def.title : 'Start a challenge'}</Text>
          <Text style={styles.rowMeta}>
            {!data.challenge
              ? 'Like 12 workouts in 4 weeks. Invite friends with a link.'
              : data.challenge.progress.status === 'won'
                ? 'Challenge won! Share it or start another.'
                : data.challenge.progress.status === 'missed'
                  ? 'This one’s over. Start another?'
                  : `Day ${data.challenge.progress.day} of ${data.challenge.def.days} · ${data.challenge.progress.done} of ${data.challenge.def.sessions} sessions`}
          </Text>
        </View>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </Pressable>

      {data.savedCount > 0 && (
        <Pressable
          onPress={() => router.push('/saved')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cardioCard, { marginBottom: space.sm }, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.cardioIcon}>
            <Icon name="bookmark" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.rowTitle}>Saved workouts</Text>
            <Text style={styles.rowMeta}>
              {data.savedCount} from shared links
            </Text>
          </View>
          <Icon name="chevron" size={20} color={colors.textMuted} />
        </Pressable>
      )}

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
  gymRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: space.sm },
  gymLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginRight: space.sm, marginBottom: space.sm },
  planCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.accent, padding: space.md, marginBottom: space.md, gap: space.md },
  planEyebrow: { ...type.label, color: colors.accent },
  planTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  planStart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.accent },
  planStartText: { color: colors.accentText, fontSize: 17, fontWeight: '800' },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, paddingBottom: space.xl * 2 },
  hero: { borderRadius: radius.lg, padding: space.lg },
  heroEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginTop: 2 },
  programTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, marginTop: space.sm, overflow: 'hidden' },
  programFill: { height: 4, backgroundColor: colors.accent },
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
});

/** Spoken summary of the recovery map: the muscles that still need rest. */
function recoveryLabel(recovery: GeneratedWorkout['recovery']): string {
  const tired = ALL_MUSCLES.filter((m) => recovery[m] < 0.8)
    .sort((a, b) => recovery[a] - recovery[b])
    .map((m) => `${MUSCLE_LABELS[m]} ${Math.round(recovery[m] * 100)}%`);
  return tired.length ? `Muscle recovery. Still recovering: ${tired.join(', ')}` : 'Muscle recovery. Every muscle is fresh.';
}
