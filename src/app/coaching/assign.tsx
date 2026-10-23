import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Icon } from '../../components/Icon';
import { Button, Chip, SectionLabel } from '../../components/ui';
import { dayLabel, localDate, type PlanItem } from '../../lib/coaching';
import { displayUnits, toKg } from '../../lib/db';
import { EXERCISES, EXERCISES_BY_ID } from '../../lib/exercises';
import { colors, radius, space } from '../../lib/theme';
import { assignWorkout } from '../../services/coaching';
import { SocialError } from '../../services/social';

interface Draft {
  exerciseId: string;
  sets: string;
  reps: string;
  weight: string;
}

/** A coach builds a workout and sends it to one client for a chosen day. */
export default function AssignScreen() {
  const { client, name } = useLocalSearchParams<{ client: string; name: string }>();
  const unit = displayUnits().weight;
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(0);
  const [items, setItems] = useState<Draft[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => localDate(new Date(Date.now() + i * 864e5))), []);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return EXERCISES.filter((e) => e.name.toLowerCase().includes(q) && !items.some((i) => i.exerciseId === e.id)).slice(0, 6);
  }, [query, items]);

  const update = (i: number, patch: Partial<Draft>) => setItems(items.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const send = async () => {
    setError(null);
    if (!title.trim()) return setError('Give the workout a name.');
    if (!items.length) return setError('Add at least one exercise.');
    const plan: PlanItem[] = [];
    for (const d of items) {
      const sets = Number(d.sets);
      const reps = Number(d.reps);
      const weight = d.weight.trim() === '' ? null : Number(d.weight);
      const name = EXERCISES_BY_ID.get(d.exerciseId)?.name;
      if (!Number.isInteger(sets) || sets < 1 || sets > 10) return setError(`${name}: sets should be 1 to 10.`);
      if (!Number.isInteger(reps) || reps < 1 || reps > 50) return setError(`${name}: reps should be 1 to 50.`);
      if (weight != null && (Number.isNaN(weight) || weight < 0)) return setError(`${name}: check the weight.`);
      plan.push({ exerciseId: d.exerciseId, sets, reps, weightKg: weight == null ? null : Math.round(toKg(weight) * 10) / 10 });
    }
    setBusy(true);
    try {
      await assignWorkout({ client, title, note, plan, scheduledFor: days[day] });
      router.back();
    } catch (e) {
      setError(e instanceof SocialError ? e.message : 'Couldn’t send the workout. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <Stack.Screen options={{ title: `Workout for ${name ?? 'client'}` }} />
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.title}
          value={title}
          onChangeText={setTitle}
          placeholder="Name, e.g. Lower body A"
          placeholderTextColor={colors.textMuted}
          maxLength={80}
          accessibilityLabel="Workout name"
        />
        <SectionLabel>Day</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {days.map((d, i) => (
            <Chip key={d} label={dayLabel(d, new Date())} selected={day === i} onPress={() => setDay(i)} />
          ))}
        </ScrollView>

        <SectionLabel>Exercises</SectionLabel>
        {items.map((d, i) => {
          const e = EXERCISES_BY_ID.get(d.exerciseId)!;
          return (
            <View key={d.exerciseId} style={styles.item}>
              <View style={styles.itemHead}>
                <ExerciseThumb exercise={e} size={40} />
                <Text style={styles.itemName} numberOfLines={1}>{e.name}</Text>
                <Pressable onPress={() => setItems(items.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${e.name}`} hitSlop={10}>
                  <Icon name="trash" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.fields}>
                <Field label="Sets" value={d.sets} onChange={(v) => update(i, { sets: v })} a11y={`${e.name} sets`} />
                <Field label="Reps" value={d.reps} onChange={(v) => update(i, { reps: v })} a11y={`${e.name} reps`} />
                <Field label={unit.toUpperCase()} value={d.weight} onChange={(v) => update(i, { weight: v })} a11y={`${e.name} weight in ${unit}, optional`} placeholder="any" />
              </View>
            </View>
          );
        })}
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Add an exercise"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Add an exercise"
          />
        </View>
        {matches.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => {
              setItems([...items, { exerciseId: e.id, sets: '3', reps: e.compound ? '8' : '12', weight: '' }]);
              setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add ${e.name}`}
            style={styles.match}
          >
            <ExerciseThumb exercise={e} size={36} />
            <Text style={styles.matchText}>{e.name}</Text>
            <Icon name="add" size={22} color={colors.accent} />
          </Pressable>
        ))}

        <SectionLabel>Note for your client</SectionLabel>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder="Optional, e.g. keep 2 reps in reserve today"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          accessibilityLabel="Note for your client"
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Button title={busy ? 'Sending…' : `Send for ${dayLabel(days[day], new Date()).toLowerCase()}`} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, a11y, placeholder }: { label: string; value: string; onChange: (v: string) => void; a11y: string; placeholder?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.field}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={a11y}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', minHeight: 48 },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  fields: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  field: {
    minHeight: 44,
    minWidth: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: space.md, marginTop: space.sm },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontSize: 16 },
  match: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  matchText: { flex: 1, color: colors.text, fontSize: 16 },
  note: { minHeight: 80, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, fontSize: 16, padding: space.md, textAlignVertical: 'top' },
  error: { color: colors.warning, fontSize: 15, marginTop: space.md },
  footer: { padding: space.md, paddingBottom: space.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
});
