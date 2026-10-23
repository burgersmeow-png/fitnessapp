import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Icon } from '../components/Icon';
import { Button, Loading } from '../components/ui';
import { MUSCLE_LABELS } from '../lib/format';
import { PROGRAMS, programStep, type Program } from '../lib/programs';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { stopFollowing } from '../services/plan';
import { loadProgram, startProgram, stopProgram } from '../services/programs';
import { router } from 'expo-router';

const LEVEL_COLOR = { Beginner: colors.success, Intermediate: colors.warning, Advanced: colors.danger };

export default function ProgramsScreen() {
  const db = useSQLiteContext();
  const [state, reload] = useFocusData(() => loadProgram(db));
  if (state === undefined) return <Loading />;
  const step = state ? programStep(state) : null;

  const start = (p: Program) => {
    const run = async () => {
      // A program replaces a followed plan, since both decide what you train next.
      await stopFollowing(db);
      await startProgram(db, p.id);
      reload();
    };
    const changes = `Your weekly goal becomes ${p.daysPerWeek} days${p.goal ? ' and your goal becomes Strength' : ''}.`;
    if (step && !step.finished) {
      confirm(`Switch to ${p.name}?`, `You’ll leave ${step.program.name} at week ${step.week}. ${changes}`, 'Switch', run);
    } else {
      confirm(`Start ${p.name}?`, changes, 'Start', run);
    }
  };
  const stop = () =>
    confirm('Stop this program?', 'Today goes back to picking whatever is most recovered. Your workouts stay in History.', 'Stop', async () => {
      await stopProgram(db);
      reload();
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: space.md }]}>
        A program sets what you train each session. Exercises and weights still adapt to your recovery, equipment and progress.
        Miss a day and it simply picks up where you left off.
      </Text>
      <Pressable
        onPress={() => router.push('/plan-new')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, styles.makeRow, pressed && { opacity: 0.85 }]}
      >
        <Icon name="share" size={22} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontWeight: '700' }]}>Make your own plan</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>Turn your workouts into a plan your followers can follow</Text>
        </View>
        <Icon name="chevron" size={14} color={colors.textMuted} />
      </Pressable>
      {PROGRAMS.map((p) => {
        const current = step?.program.id === p.id ? step : null;
        return (
          <View key={p.id} style={[styles.card, current && styles.current]}>
            <View style={styles.head}>
              <Text style={[type.title, { flex: 1 }]}>{p.name}</Text>
              <Text style={[styles.level, { color: LEVEL_COLOR[p.level] }]}>{p.level.toUpperCase()}</Text>
            </View>
            <Text style={styles.meta}>
              {p.daysPerWeek} days a week · {p.weeks} weeks{p.deloadEvery < p.weeks ? ` · lighter every ${p.deloadEvery}th week` : ''}
            </Text>
            <Text style={styles.blurb}>{p.blurb}</Text>
            <View style={styles.days}>
              {p.days.map((d, i) => (
                <View key={i} style={[styles.day, current && !current.finished && i === (current.dayOfWeek - 1) % p.days.length && styles.dayNext]}>
                  <Text style={styles.dayName}>{d.name}</Text>
                  <Text style={styles.dayFocus} numberOfLines={2}>
                    {d.focus.map((m) => MUSCLE_LABELS[m]).join(', ')}
                  </Text>
                </View>
              ))}
            </View>
            {current ? (
              <>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(current.progress * 100)}%` }]} />
                </View>
                <Text style={styles.meta}>
                  {current.finished
                    ? 'Complete. Nice work! Start it again or pick a new one.'
                    : `Week ${current.week} of ${p.weeks}, day ${current.dayOfWeek}: ${current.day.name}${current.deload ? ' (deload)' : ''}`}
                </Text>
                {current.finished ? (
                  <Button title="Start again" onPress={() => start(p)} style={{ marginTop: space.md }} />
                ) : (
                  <Pressable onPress={stop} accessibilityRole="button" style={styles.stop} hitSlop={8}>
                    <Icon name="close" size={16} color={colors.textMuted} />
                    <Text style={styles.stopText}>Stop program</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Button title="Start" variant="secondary" onPress={() => start(p)} style={{ marginTop: space.md }} />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.md, borderWidth: 1, borderColor: 'transparent' },
  current: { borderColor: colors.accent },
  makeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  level: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: space.xs },
  blurb: { color: colors.text, fontSize: 15, marginTop: space.sm, lineHeight: 21 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  day: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, padding: space.sm, borderWidth: 1, borderColor: 'transparent' },
  dayNext: { borderColor: colors.accent },
  dayName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dayFocus: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, marginTop: space.md, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space.md },
  stopText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
