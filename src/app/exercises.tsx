import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { Chip } from '../components/ui';
import { loadExercises } from '../lib/db';
import { MUSCLE_LABELS } from '../lib/format';
import { colors, radius, space } from '../lib/theme';
import { ALL_MUSCLES, type Muscle } from '../lib/types';
import { useFocusData } from '../lib/useData';

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
        ListHeaderComponent={
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/exercise-new')}>
            <View style={styles.addIcon}>
              <Icon name="add" size={26} color={colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={[styles.name, { color: colors.accent }]}>New exercise</Text>
              <Text style={[styles.meta, { textTransform: 'none' }]}>Add a lift that isn’t in the list</Text>
            </View>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push(`/exercise/${item.id}`)}>
            <ExerciseThumb exercise={item} size={52} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.primary.map((m) => MUSCLE_LABELS[m]).join(', ')} · {item.equipment}
                {item.custom ? ' · yours' : ''}
              </Text>
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  addIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2, textTransform: 'capitalize' },
});
