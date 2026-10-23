import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CARDIO_BY_TYPE } from '../../lib/cardio';
import { displayUnits, fromKg, fromKm } from '../../lib/db';
import { formatNumber } from '../../lib/format';
import { timeAgo, type FeedPost } from '../../lib/social';
import { colors, radius, space } from '../../lib/theme';
import { Icon } from '../Icon';
import { Avatar } from './Avatar';

/** One shared workout or cardio session. Tap for comments; the hand gives a high-five. */
export function FeedCard({ post, me, onHighFive, detail }: { post: FeedPost; me: string; onHighFive: (on: boolean) => void; detail?: boolean }) {
  const units = displayUnits();
  const mine = post.highFives.includes(me);
  const b = post.body;
  const stats =
    'volumeKg' in b
      ? [`${b.minutes} min`, `${b.sets} sets`, ...(b.volumeKg > 0 ? [`${formatNumber(fromKg(b.volumeKg))} ${units.weight} lifted`] : [])]
      : [`${b.minutes} min`, ...(b.distanceKm != null ? [`${fromKm(b.distanceKm)} ${units.distance}`] : [])];
  const icon = 'cardioType' in b ? (CARDIO_BY_TYPE.get(b.cardioType)?.icon ?? 'pulse') : 'exercises';

  const open = () => router.push(`/post/${post.id}`);
  const summary = (
    <>
      <View style={styles.head}>
        <Avatar profile={post.author} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{post.author.id === me ? 'You' : post.author.displayName}</Text>
          <Text style={styles.meta}>@{post.author.username} · {timeAgo(post.happenedAt)}</Text>
        </View>
        <Icon name={icon} size={20} color={colors.accent} />
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.stats}>{stats.join('  ·  ')}</Text>
      {'exercises' in b && b.prs.length > 0 && <Text style={styles.pr}>🏆 New PR{b.prs.length > 1 ? 's' : ''}: {b.prs.join(', ')}</Text>}
      {'exercises' in b &&
        b.exercises.slice(0, detail ? undefined : 3).map((e) => (
          <Text key={e.name} style={styles.exercise} numberOfLines={1}>
            {e.name}
            <Text style={styles.meta}>
              {'  '}
              {e.sets} {e.sets === 1 ? 'set' : 'sets'}
              {e.bestKg != null && e.bestReps != null ? `, best ${formatNumber(fromKg(e.bestKg))} ${units.weight} × ${e.bestReps}` : ''}
            </Text>
          </Text>
        ))}
      {'exercises' in b && !detail && b.exercises.length > 3 && <Text style={styles.meta}>+{b.exercises.length - 3} more</Text>}
    </>
  );

  // The summary and the buttons are siblings, not nested, so each tap does one thing.
  return (
    <View style={styles.card}>
      {detail ? (
        summary
      ) : (
        <Pressable onPress={open} accessibilityRole="button" accessibilityHint="Opens comments">
          {summary}
        </Pressable>
      )}
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onHighFive(!mine);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: mine }}
          accessibilityLabel={`High-five, ${post.highFives.length}`}
          hitSlop={8}
          style={styles.action}
        >
          <Icon name={mine ? 'highFive' : 'highFiveOff'} size={20} color={mine ? colors.accent : colors.textMuted} />
          <Text style={[styles.count, mine && { color: colors.accent }]}>{post.highFives.length || ''}</Text>
        </Pressable>
        {!detail && (
          <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Comments, ${post.comments}`} hitSlop={8} style={styles.action}>
            <Icon name="comment" size={20} color={colors.textMuted} />
            <Text style={styles.count}>{post.comments || ''}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: space.xs },
  stats: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: space.xs, marginBottom: space.xs },
  pr: { color: colors.success, fontSize: 14, fontWeight: '700', marginVertical: space.xs },
  exercise: { color: colors.text, fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: space.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  count: { color: colors.textMuted, fontSize: 15, fontWeight: '700', minWidth: 12 },
});
