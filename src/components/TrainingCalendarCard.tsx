import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TrainingCalendar } from '../lib/trainingCalendar';
import { colors, radius, space, type } from '../lib/theme';
import { Icon } from './Icon';

/** Every day of the last six months as a square: lifted, cardio, or rest. */
export function TrainingCalendarCard({ calendar, onShare }: { calendar: TrainingCalendar; onShare: () => void }) {
  const cols = calendar.weeks.length;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontWeight: '700' }]}>{`${calendar.daysTrained} ${calendar.daysTrained === 1 ? 'day' : 'days'} trained`}</Text>
          <Text style={styles.meta}>Last 6 months · best week {calendar.bestWeek} {calendar.bestWeek === 1 ? 'day' : 'days'}</Text>
        </View>
        <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share your training calendar" style={styles.share}>
          <Icon name="share" size={16} color={colors.accent} />
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.months}>
        {calendar.months.map((m) => (
          <Text key={`${m.week}-${m.label}`} style={[styles.month, { left: `${(m.week / cols) * 100}%` }]}>
            {m.label}
          </Text>
        ))}
      </View>
      <View
        style={styles.grid}
        accessible
        accessibilityLabel={`Training calendar: ${calendar.daysTrained} days trained in the last ${cols} weeks.`}
      >
        {calendar.weeks.map((week, w) => (
          <View key={w} style={styles.col}>
            {week.map((d) => (
              <View
                key={d.key}
                style={[
                  styles.cell,
                  d.future ? styles.future : d.level === 2 ? styles.lift : d.level === 1 ? styles.cardio : null,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.key, styles.lift]} />
        <Text style={styles.meta}>Lifted</Text>
        <View style={[styles.key, styles.cardio, { marginLeft: space.md }]} />
        <Text style={styles.meta}>Cardio</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  meta: { color: colors.textMuted, fontSize: 13 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  months: { height: 16, marginBottom: 4 },
  month: { position: 'absolute', color: colors.textMuted, fontSize: 11 },
  grid: { flexDirection: 'row', gap: 2 },
  col: { flex: 1, gap: 2 },
  cell: { aspectRatio: 1, borderRadius: 2, backgroundColor: colors.surfaceRaised },
  lift: { backgroundColor: colors.accent },
  cardio: { backgroundColor: colors.accent, opacity: 0.45 },
  future: { backgroundColor: 'transparent' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  key: { width: 10, height: 10, borderRadius: 2 },
});
