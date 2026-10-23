import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { goalLine, type Badge, type WeekProgress } from '../lib/habits';
import { colors, radius, space } from '../lib/theme';
import { Icon } from './Icon';
import { ProgressRing } from './ProgressRing';

/** This week's goal ring and streak on Today, with any badge not yet celebrated. */
export function GoalCard({ progress, fresh }: { progress: WeekProgress; fresh: Badge[] }) {
  const hit = progress.done >= progress.goal;
  return (
    <Pressable
      onPress={() => router.push('/badges')}
      accessibilityRole="button"
      accessibilityHint="Shows your badges"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.row}>
        <ProgressRing done={progress.done} total={progress.goal} size={64} stroke={6} what="training days" />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={styles.title}>{hit ? 'Weekly goal hit' : 'Weekly goal'}</Text>
          <Text style={styles.meta}>{goalLine(progress)}</Text>
        </View>
        {progress.streak > 0 && (
          <View style={styles.streak} accessible accessibilityLabel={`${progress.streak} week streak`}>
            <Icon name="flame" size={18} color={colors.accent} />
            <Text style={styles.streakText}>{progress.streak}</Text>
            <Text style={styles.streakLabel}>{progress.streak === 1 ? 'WEEK' : 'WEEKS'}</Text>
          </View>
        )}
      </View>
      {fresh.length > 0 && (
        <View style={styles.fresh}>
          <Icon name="medal" size={18} color={colors.warning} />
          <Text style={styles.freshText} numberOfLines={2}>
            {fresh.length === 1 ? `New badge: ${fresh[0].title}` : `${fresh.length} new badges: ${fresh.map((b) => b.title).join(', ')}`}
          </Text>
          <Icon name="chevron" size={14} color={colors.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  streak: { alignItems: 'center', marginLeft: space.sm, minWidth: 48 },
  streakText: { color: colors.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  streakLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  fresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  freshText: { flex: 1, color: colors.warning, fontSize: 14, fontWeight: '700' },
});
