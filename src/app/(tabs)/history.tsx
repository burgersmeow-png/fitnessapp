import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui';
import { loadSettings, loadWorkouts, type WorkoutSummary } from '../../lib/db';
import { formatDate, formatDuration, formatNumber } from '../../lib/format';
import { colors, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';

/** Consecutive weeks (Monday start) with at least one workout, counting back from this week. */
function weekStreak(workouts: WorkoutSummary[]): number {
  const weekKey = (d: Date) => {
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday.getTime();
  };
  const weeks = new Set(workouts.map((w) => weekKey(new Date(w.startedAt))));
  let streak = 0;
  let cursor = weekKey(new Date());
  // This week still counts if the user hasn't trained yet.
  if (!weeks.has(cursor)) cursor -= 7 * 864e5;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= 7 * 864e5;
  }
  return streak;
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const [data] = useFocusData(async () => ({ workouts: await loadWorkouts(db), settings: await loadSettings(db) }));
  if (!data) return <View style={styles.screen} />;
  const { workouts, settings } = data;
  const streak = weekStreak(workouts);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: space.md, gap: space.md }}
      data={workouts}
      keyExtractor={(w) => String(w.id)}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Card style={{ flex: 1 }}>
            <Ionicons name="flame" size={20} color={colors.accent} />
            <Text style={type.number}>{streak}</Text>
            <Text style={type.label}>WEEK STREAK</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Ionicons name="trophy" size={20} color={colors.warning} />
            <Text style={type.number}>{workouts.length}</Text>
            <Text style={type.label}>WORKOUTS</Text>
          </Card>
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Ionicons name="barbell" size={56} color={colors.border} />
          <Text style={[type.title, { marginTop: space.md }]}>No workouts yet</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', marginTop: space.xs }]}>
            Finish your first workout and it shows up here.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.title}>{formatDate(item.startedAt)}</Text>
            <Text style={styles.meta}>{formatDuration(item.startedAt, item.finishedAt)}</Text>
          </View>
          <Text style={styles.meta}>
            {item.sets} sets · {formatNumber(item.volume)} {settings.units} volume
          </Text>
          <Text style={[type.body, { marginTop: space.sm }]} numberOfLines={2}>
            {item.exercises.split(',').join(', ')}
          </Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
