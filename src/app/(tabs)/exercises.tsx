import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip } from '../../components/ui';
import { loadExercises } from '../../lib/db';
import { MUSCLE_LABELS } from '../../lib/format';
import { colors, radius, space } from '../../lib/theme';
import { ALL_MUSCLES, type Muscle } from '../../lib/types';
import { useFocusData } from '../../lib/useData';

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const [exercises] = useFocusData(() => loadExercises(db));
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);

  const filtered = useMemo(
    () =>
      (exercises ?? []).filter(
        (e) =>
          (!muscle || e.primary.includes(muscle)) &&
          e.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [exercises, query, muscle],
  );

  return (
    <View style={styles.screen}>
      <View style={{ padding: space.md, paddingBottom: 0 }}>
        <TextInput
          style={styles.search}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.md }}>
          <Chip label="All" selected={muscle == null} onPress={() => setMuscle(null)} />
          {ALL_MUSCLES.map((m) => (
            <Chip key={m} label={MUSCLE_LABELS[m]} selected={muscle === m} onPress={() => setMuscle(m)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xl }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/exercise/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · {item.equipment}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  search: {
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2, textTransform: 'capitalize' },
});
