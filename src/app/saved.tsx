import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Icon } from '../components/Icon';
import { Card, Loading } from '../components/ui';
import { formatDate } from '../lib/format';
import { colors, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { forgetWorkout, loadSaved } from '../services/savedWorkouts';

/** Workouts kept from shared links. */
export default function SavedWorkoutsScreen() {
  const db = useSQLiteContext();
  const [saved, reload] = useFocusData(() => loadSaved(db));
  if (!saved) return <Loading />;

  if (saved.length === 0) {
    return (
      <View style={[styles.screen, { alignItems: 'center', padding: space.xl }]}>
        <Icon name="bookmark" size={56} color={colors.border} />
        <Text style={[type.title, { marginTop: space.md }]}>Nothing saved yet</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: space.xs }]}>
          When someone shares a workout link, tap Save for later and it shows up here.
        </Text>
      </View>
    );
  }

  const remove = (id: string, title: string) =>
    confirm(`Remove ${title}?`, 'You can save it again from the link.', 'Remove', async () => {
      await forgetWorkout(db, id);
      reload();
    }, true);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      {saved.map((s) => (
        <Card key={s.id} style={styles.card}>
          <Pressable onPress={() => router.push({ pathname: '/try', params: { w: s.id } })} style={styles.main} accessibilityRole="button">
            <Text style={styles.name} numberOfLines={1}>{s.title}</Text>
            <Text style={styles.muted}>
              {s.lifts} {s.lifts === 1 ? 'lift' : 'lifts'} · {s.sets} sets · saved {formatDate(s.savedAt)}
            </Text>
          </Pressable>
          <Pressable onPress={() => remove(s.id, s.title)} hitSlop={8} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remove ${s.title}`}>
            <Icon name="trash" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, paddingVertical: space.sm },
  main: { flex: 1, minHeight: 48, justifyContent: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
