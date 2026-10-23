import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Button, Loading, SectionLabel } from '../components/ui';
import { loadExercises, loadWorkouts, loadWorkoutSets } from '../lib/db';
import { formatDate } from '../lib/format';
import { encodePlan, MAX_DAYS, PLAN_TITLE_MAX, planUrl, type PlanLink } from '../lib/planLink';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { linkFromSets, TITLE_MAX } from '../lib/workoutLink';
import { linkWithMyCode } from '../services/creatorCode';
import { SITE_URL } from '../services/server';
import { shareLink } from '../services/shareLink';
import { ShareCardSheet } from '../components/ShareCardSheet';
import { planCardContent, type CardContent } from '../lib/shareCard';

type Day = { workoutId: number; title: string; summary: string };

/** Build a plan from your own past workouts and share it as one link. */
export default function NewPlanScreen() {
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<Day[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [card, setCard] = useState<CardContent | null>(null);
  const [workouts] = useFocusData(async () => (await loadWorkouts(db)).slice(0, 30));
  if (!workouts) return <Loading />;

  const add = (id: number, exercises: string) => {
    if (days.length >= MAX_DAYS) return setStatus(`A plan can have up to ${MAX_DAYS} days.`);
    setStatus(null);
    setDays([...days, { workoutId: id, title: '', summary: exercises.replace(/,/g, ', ') }]);
  };
  const rename = (i: number, t: string) => setDays(days.map((d, j) => (j === i ? { ...d, title: t } : d)));
  const remove = (i: number) => setDays(days.filter((_, j) => j !== i));

  const build = async (): Promise<PlanLink> => {
    const names = new Map((await loadExercises(db)).map((e) => [e.id, e.name]));
    const linked = await Promise.all(
      days.map(async (d, i) => linkFromSets(d.title.trim() || `Day ${i + 1}`, await loadWorkoutSets(db, d.workoutId), (id) => names.get(id) ?? id)),
    );
    return { title: title.trim() || `My ${days.length}-day plan`, days: linked };
  };
  const share = async () => {
    setStatus(null);
    try {
      const plan = await build();
      const r = await shareLink(`Follow my LiftLab plan "${plan.title}":`, await linkWithMyCode(db, planUrl(SITE_URL, plan)));
      if (r === 'copied') setStatus('Link copied. Paste it in your bio, story or a message.');
    } catch {
      setStatus('Could not share the link.');
    }
  };
  const preview = async () => router.push({ pathname: '/plan', params: { p: encodePlan(await build()) } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sub}>Pick workouts you’ve done, in the order to do them. Followers get the same lifts, sets and reps, with weights from their own history.</Text>

      <SectionLabel>Plan name</SectionLabel>
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={PLAN_TITLE_MAX}
        placeholder="e.g. Alex’s 4-day split"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel="Plan name"
      />

      <SectionLabel>{days.length ? `Days (${days.length})` : 'Days'}</SectionLabel>
      {days.length === 0 && <Text style={styles.sub}>Tap workouts below to add them.</Text>}
      {days.map((d, i) => (
        <View key={`${d.workoutId}-${i}`} style={styles.dayRow}>
          <Text style={styles.dayNum}>{i + 1}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={d.title}
              onChangeText={(t) => rename(i, t)}
              maxLength={TITLE_MAX}
              placeholder={`Day ${i + 1}, e.g. Push`}
              placeholderTextColor={colors.textMuted}
              style={styles.dayInput}
              accessibilityLabel={`Day ${i + 1} name`}
            />
            <Text style={styles.meta} numberOfLines={1}>{d.summary}</Text>
          </View>
          <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.icon} accessibilityRole="button" accessibilityLabel={`Remove day ${i + 1}`}>
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {status && <Text style={styles.status}>{status}</Text>}
      {days.length > 0 && (
        <View style={styles.actions}>
          <Button title="Preview" variant="secondary" onPress={preview} style={{ flex: 1 }} />
          <Button title="Share plan" onPress={share} style={{ flex: 1 }} />
        </View>
      )}
      {days.length > 0 && (
        <Button title="Story image" variant="secondary" onPress={async () => setCard(planCardContent(await build()))} style={{ marginTop: space.sm }} />
      )}
      <ShareCardSheet content={card} onClose={() => setCard(null)} title="Post it to your story" fileName="liftlab-plan.png" />

      <SectionLabel>Your workouts</SectionLabel>
      {workouts.length === 0 && <Text style={styles.sub}>Finish a workout first, then it can go in a plan.</Text>}
      {workouts.map((w) => (
        <Pressable
          key={w.id}
          onPress={() => add(w.id, w.exercises)}
          style={({ pressed }) => [styles.workout, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={`Add workout from ${formatDate(w.startedAt)}`}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{formatDate(w.startedAt)}</Text>
            <Text style={styles.meta} numberOfLines={2}>{w.exercises.replace(/,/g, ', ')}</Text>
          </View>
          <Icon name="add" size={22} color={colors.accent} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sub: { color: colors.textMuted, fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: space.sm },
  input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, fontSize: 17 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm },
  dayNum: { width: 28, textAlign: 'center', color: colors.accent, fontSize: 18, fontWeight: '800' },
  dayInput: { color: colors.text, fontSize: 16, fontWeight: '700', minHeight: 36, padding: 0 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  workout: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, minHeight: 64 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
