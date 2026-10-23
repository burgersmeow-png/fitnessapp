import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayLabel, nextAssignment, planToWorkout, type Assignment } from '../lib/coaching';
import { fromKg, startWorkout } from '../lib/db';
import { EXERCISES_BY_ID } from '../lib/exercises';
import { colors, radius, space } from '../lib/theme';
import { flushAssignmentsDone, loadAssignments, rememberAssignment } from '../services/coaching';
import { flushShareQueue, myId } from '../services/social';
import { socialConfigured } from '../services/supabase';
import { Icon } from './Icon';

/** "From your coach" on Today, when a coach has planned a workout for today (or one is overdue). */
export function CoachPlanCard({ activeId }: { activeId: number | null }) {
  const db = useSQLiteContext();
  const [plan, setPlan] = useState<Assignment | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!socialConfigured) return;
      let live = true;
      (async () => {
        try {
          // Send anything finished offline first, so a done workout doesn't reappear.
          await Promise.all([flushAssignmentsDone(db), flushShareQueue(db)]);
          const me = await myId();
          const mine = (await loadAssignments()).filter((a) => a.client === me);
          if (live) setPlan(nextAssignment(mine, new Date()));
        } catch {
          // Signed out or offline: just don't show the card.
        }
      })();
      return () => {
        live = false;
      };
    }, [db]),
  );

  if (!plan) return null;

  const start = async () => {
    if (activeId == null) {
      const workoutId = await startWorkout(db, planToWorkout(plan.plan, fromKg));
      await rememberAssignment(db, plan.id, workoutId);
    }
    router.push('/workout');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FROM YOUR COACH · {dayLabel(plan.scheduledFor, new Date()).toUpperCase()}</Text>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.meta} numberOfLines={2}>
        {plan.plan.map((p) => `${EXERCISES_BY_ID.get(p.exerciseId)?.name ?? p.exerciseId} ${p.sets}×${p.reps}`).join(' · ')}
      </Text>
      {plan.note ? <Text style={styles.note}>“{plan.note}”</Text> : null}
      <Pressable onPress={start} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
        <Icon name="play" size={16} color={colors.accentText} />
        <Text style={styles.buttonText}>{activeId != null ? 'Resume workout' : 'Start coach’s workout'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: space.md,
  },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 6 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: space.xs, lineHeight: 19 },
  note: { color: colors.text, fontSize: 15, fontStyle: 'italic', marginTop: space.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    marginTop: space.md,
  },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '800' },
});
