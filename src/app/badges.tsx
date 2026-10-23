import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { ShareCardSheet } from '../components/ShareCardSheet';
import { Loading } from '../components/ui';
import { loadSettings } from '../lib/db';
import { formatDate } from '../lib/format';
import { badgeHow, BADGES, goalLine, weekProgress } from '../lib/habits';
import { badgeCardContent, type CardContent } from '../lib/shareCard';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { checkBadges, loadSessionDates, markBadgesSeen } from '../services/habits';

export default function BadgesScreen() {
  const db = useSQLiteContext();
  const [card, setCard] = useState<CardContent | null>(null);
  const [data] = useFocusData(async () => {
    const settings = await loadSettings(db);
    const [state, dates] = await Promise.all([checkBadges(db, settings.weeklyGoal), loadSessionDates(db)]);
    return { ...state, settings, week: weekProgress(dates, settings.weeklyGoal) };
  });
  // Opening this screen counts as seeing the new ones; they stay highlighted until next time.
  useEffect(() => {
    if (data?.fresh.length) markBadgesSeen(db);
  }, [data, db]);
  if (!data) return <Loading />;
  const { earned, stats, settings, week } = data;
  const freshIds = new Set(data.fresh.map((b) => b.id));
  const count = BADGES.filter((b) => earned[b.id]).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <View style={styles.summary}>
        <ProgressRing done={week.done} total={week.goal} size={72} stroke={6} what="training days" />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={type.title}>{week.streak > 0 ? `${week.streak}-week streak` : 'Start a streak'}</Text>
          <Text style={styles.meta}>{goalLine(week)}</Text>
          {stats.bestStreak > week.streak && (
            <Text style={styles.meta}>
              Best run: {stats.bestStreak} weeks at {settings.weeklyGoal} {settings.weeklyGoal === 1 ? 'day' : 'days'} a week.
            </Text>
          )}
        </View>
      </View>

      <Text style={[type.label, { marginTop: space.lg, marginBottom: space.sm }]}>{`${count} OF ${BADGES.length} BADGES`}</Text>
      <View style={styles.grid}>
        {BADGES.map((b) => {
          const got = earned[b.id];
          const progress = b.progress(stats);
          return (
            <Pressable
              key={b.id}
              style={({ pressed }) => [styles.badge, freshIds.has(b.id) && styles.fresh, pressed && got && { opacity: 0.8 }]}
              disabled={!got}
              onPress={() =>
                got &&
                setCard(
                  badgeCardContent({
                    title: b.title,
                    how: badgeHow(b, settings.units),
                    at: got.at,
                    earned: count,
                    total: BADGES.length,
                    workouts: stats.workouts,
                    bestStreak: stats.bestStreak,
                  }),
                )
              }
              accessibilityRole={got ? 'button' : undefined}
              accessibilityLabel={`${b.title}. ${got ? 'Earned. Share it' : `Locked. ${badgeHow(b, settings.units)}`}`}
            >
              <View style={[styles.medal, got ? { backgroundColor: 'rgba(245,181,61,0.16)' } : null]}>
                <Icon name={got ? b.icon : 'lock'} size={26} color={got ? colors.warning : colors.textMuted} />
              </View>
              <Text style={[styles.title, !got && { color: colors.textMuted }]} numberOfLines={2}>
                {b.title}
              </Text>
              {got ? (
                <Text style={styles.small}>{freshIds.has(b.id) ? 'New!' : formatDate(got.at)}</Text>
              ) : (
                <>
                  <Text style={styles.small} numberOfLines={3}>
                    {badgeHow(b, settings.units)}
                  </Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                </>
              )}
              {got && (
                <View style={styles.shareHint}>
                  <Icon name="share" size={13} color={colors.accent} />
                  <Text style={styles.shareText}>Share</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <ShareCardSheet content={card} onClose={() => setCard(null)} title="Share your badge" fileName="liftlab-badge.png" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shareHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.xs },
  shareText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  screen: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.sm,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fresh: { borderColor: colors.warning },
  medal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    marginBottom: space.sm,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  small: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.surfaceRaised, marginTop: space.sm, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent },
});
