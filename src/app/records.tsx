import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Icon } from '../components/Icon';
import { Card, Loading, SectionLabel } from '../components/ui';
import { loadExercises, loadHistory, loadSettings } from '../lib/db';
import { formatDate, formatNumber } from '../lib/format';
import { liftRecords, prHistory } from '../lib/records';
import { colors, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';

const round = (n: number) => formatNumber(Math.round(n));

export default function RecordsScreen() {
  const db = useSQLiteContext();
  const [data] = useFocusData(async () => {
    const [history, exercises, settings] = await Promise.all([loadHistory(db), loadExercises(db), loadSettings(db)]);
    return { records: liftRecords(history), prs: prHistory(history, 10), exercises: new Map(exercises.map((e) => [e.id, e])), unit: settings.units };
  });
  if (!data) return <Loading />;
  const { records, prs, exercises, unit } = data;
  const name = (id: string) => exercises.get(id)?.name ?? id;
  const open = (id: string) => router.push(`/exercise/${id}`);

  if (records.length === 0) {
    return (
      <View style={[styles.screen, { alignItems: 'center', padding: space.xl }]}>
        <Icon name="trophy" size={56} color={colors.border} />
        <Text style={[type.title, { marginTop: space.md }]}>No records yet</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: space.xs }]}>Finish a workout and your best sets show up here.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <SectionLabel>Recent PRs</SectionLabel>
      <Card>
        {prs.length === 0 ? (
          <Text style={styles.muted}>Your first session of a lift sets the bar. Beat it next time and the PR shows up here.</Text>
        ) : (
          prs.map((p, i) => (
            <Pressable key={`${p.exerciseId}-${p.at}`} onPress={() => open(p.exerciseId)} style={[styles.prRow, i > 0 && styles.divider]} accessibilityRole="button">
              <Icon name="trophy" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name(p.exerciseId)}</Text>
                <Text style={styles.muted}>
                  {formatNumber(p.weight)} {unit} × {p.reps} · {formatDate(p.at)}
                </Text>
              </View>
              <Text style={styles.gain}>+{round(p.gain)} {unit}</Text>
            </Pressable>
          ))
        )}
        {prs.length > 0 && <Text style={[styles.small, { marginTop: space.sm }]}>Gain is how much your estimated 1-rep max went up.</Text>}
      </Card>

      <SectionLabel>Best by lift</SectionLabel>
      {records.map((r) => {
        const e = exercises.get(r.exerciseId);
        return (
          <Pressable key={r.exerciseId} onPress={() => open(r.exerciseId)} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <Card style={styles.liftCard}>
              {e && <ExerciseThumb exercise={e} size={48} />}
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={styles.name} numberOfLines={1}>{name(r.exerciseId)}</Text>
                {r.best ? (
                  <Text style={styles.muted}>
                    Best set {formatNumber(r.best.weight)} × {r.best.reps}
                    {r.heaviest && r.heaviest.weight > r.best.weight ? ` · heaviest ${formatNumber(r.heaviest.weight)} × ${r.heaviest.reps}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.muted}>Most reps in a set · {formatDate(r.mostReps.at)}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.big}>{r.best ? round(r.best.e1rm) : r.mostReps.reps}</Text>
                <Text style={styles.small}>{r.best ? `est. max ${unit}` : 'reps'}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  muted: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  small: { color: colors.textMuted, fontSize: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  gain: { color: colors.success, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liftCard: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, paddingVertical: space.sm },
  big: { color: colors.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
