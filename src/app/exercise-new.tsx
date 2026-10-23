import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, SectionLabel } from '../components/ui';
import { draftProblem, makeCustomExercise, NAME_MAX, type CustomDraft } from '../lib/customExercise';
import { loadExercises, saveCustomExercise } from '../lib/db';
import { MUSCLE_LABELS } from '../lib/format';
import { colors, radius, space, type } from '../lib/theme';
import { ALL_EQUIPMENT, ALL_MUSCLES, type Muscle } from '../lib/types';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function NewExerciseScreen() {
  const db = useSQLiteContext();
  const [draft, setDraft] = useState<CustomDraft>({ name: '', equipment: null, primary: [], secondary: [] });
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setProblem(null), [draft]);
  const toggle = (list: Muscle[], m: Muscle) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);

  const save = async () => {
    const all = await loadExercises(db);
    const issue = draftProblem(draft, all.map((e) => e.name));
    if (issue) return setProblem(issue);
    const e = makeCustomExercise(draft, all.map((x) => x.id));
    await saveCustomExercise(db, e);
    router.replace(`/exercise/${e.id}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      <Text style={type.hero}>New exercise</Text>
      <Text style={styles.sub}>For lifts that aren’t in the list. Planned workouts can include it, and it gets the same weight suggestions.</Text>

      <SectionLabel>Name</SectionLabel>
      <TextInput
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        placeholder="e.g. Landmine Press"
        placeholderTextColor={colors.textMuted}
        maxLength={NAME_MAX}
        style={styles.input}
        accessibilityLabel="Exercise name"
      />

      <SectionLabel>Equipment</SectionLabel>
      <View style={styles.wrap}>
        {ALL_EQUIPMENT.map((q) => (
          <Chip key={q} label={cap(q)} selected={draft.equipment === q} onPress={() => setDraft({ ...draft, equipment: q })} />
        ))}
      </View>

      <SectionLabel>Main muscles</SectionLabel>
      <View style={styles.wrap}>
        {ALL_MUSCLES.map((m) => (
          <Chip
            key={m}
            label={MUSCLE_LABELS[m]}
            selected={draft.primary.includes(m)}
            onPress={() => setDraft({ ...draft, primary: toggle(draft.primary, m), secondary: draft.secondary.filter((x) => x !== m) })}
          />
        ))}
      </View>

      <SectionLabel>Helper muscles (optional)</SectionLabel>
      <View style={styles.wrap}>
        {ALL_MUSCLES.filter((m) => !draft.primary.includes(m)).map((m) => (
          <Chip key={m} label={MUSCLE_LABELS[m]} selected={draft.secondary.includes(m)} onPress={() => setDraft({ ...draft, secondary: toggle(draft.secondary, m) })} />
        ))}
      </View>
      <Text style={styles.sub}>Helper muscles count half toward recovery and weekly sets.</Text>

      {problem && <Text style={styles.problem}>{problem}</Text>}
      <Button title="Save exercise" onPress={save} style={{ marginTop: space.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: space.sm, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 17,
  },
  problem: { color: colors.warning, fontSize: 15, marginTop: space.md },
});
