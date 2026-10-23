import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { ShareCardSheet } from '../../components/ShareCardSheet';
import { Card, Loading } from '../../components/ui';
import { CARDIO_BY_TYPE, EFFORTS, type CardioSession } from '../../lib/cardio';
import { loadCardio, loadExercises, loadHistory, loadSettings, loadWorkouts, type WorkoutSummary } from '../../lib/db';
import { formatDate, formatDuration, formatNumber } from '../../lib/format';
import { BADGES, weekProgress } from '../../lib/habits';
import { recapContent, recapMonth, recapWeek, weekRecapContent } from '../../lib/recap';
import { startOfWeek } from '../../lib/social';
import { prHistory } from '../../lib/records';
import type { CardContent } from '../../lib/shareCard';
import { colors, radius, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import { checkBadges } from '../../services/habits';

type Entry = { kind: 'lift'; at: string; workout: WorkoutSummary } | { kind: 'cardio'; at: string; cardio: CardioSession };

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ share?: string }>();
  const [card, setCard] = useState<{ content: CardContent; week: boolean } | null>(null);
  const [data] = useFocusData(async () => {
    const settings = await loadSettings(db);
    const [workouts, cardio, badges] = await Promise.all([loadWorkouts(db), loadCardio(db), checkBadges(db, settings.weeklyGoal)]);
    return { workouts, cardio, settings, badges: Object.keys(badges.earned).length };
  });
  const shareRef = useRef<(which: 'week' | 'month') => void>(undefined);
  // The Sunday recap reminder opens History with the week card up.
  useEffect(() => {
    if (params.share !== 'week' || !data) return;
    router.setParams({ share: undefined });
    shareRef.current?.('week');
  }, [params.share, data]);
  if (!data) return <Loading />;
  const { workouts, cardio, settings } = data;
  const entries: Entry[] = [
    ...workouts.map((w) => ({ kind: 'lift' as const, at: w.startedAt, workout: w })),
    ...cardio.map((c) => ({ kind: 'cardio' as const, at: c.startedAt, cardio: c })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const streak = weekProgress(entries.map((e) => e.at), settings.weeklyGoal).streak;
  const month = recapMonth(new Date(), entries.map((e) => e.at));
  const monthName = month.toLocaleDateString(undefined, { month: 'long' });
  const trainedThisMonth = entries.some((e) => new Date(e.at).getMonth() === month.getMonth() && new Date(e.at).getFullYear() === month.getFullYear());

  const week = recapWeek(new Date(), entries.map((e) => e.at));
  const weekEnd = week.getTime() + 7 * 864e5;
  const trainedThisWeek = entries.some((e) => Date.parse(e.at) >= week.getTime() && Date.parse(e.at) < weekEnd);
  const weekName = week.getTime() === startOfWeek(new Date()).getTime() ? 'week' : 'last week';

  // Sets and exercises are only needed for the card, so they load on tap.
  const share = async (which: 'week' | 'month') => {
    const [history, exercises] = await Promise.all([loadHistory(db), loadExercises(db)]);
    const names = new Map(exercises.map((e) => [e.id, e.name]));
    const r = { workouts, cardio, history, prs: prHistory(history, 1000), name: (id: string) => names.get(id) ?? id, units: settings.units };
    const content = which === 'week' ? weekRecapContent({ ...r, week }) : recapContent({ ...r, month });
    if (content) setCard({ content, week: which === 'week' });
  };
  shareRef.current = share;

  return (
    <>
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: space.md, gap: space.md }}
      data={entries}
      keyExtractor={(e) => (e.kind === 'lift' ? `w${e.workout.id}` : `c${e.cardio.id}`)}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Card style={{ flex: 1, flexBasis: 0 }}>
            <Icon name="flame" size={20} color={colors.accent} />
            <Text style={type.number}>
              {streak}
              <Text style={styles.of}> wk</Text>
            </Text>
            <Text style={type.label}>STREAK</Text>
          </Card>
          <Card style={{ flex: 1, flexBasis: 0 }}>
            <Icon name="trophy" size={20} color={colors.success} />
            <Text style={type.number}>{entries.length}</Text>
            <Text style={type.label}>SESSIONS</Text>
          </Card>
          <Pressable style={{ flex: 1, flexBasis: 0 }} onPress={() => router.push('/badges')} accessibilityRole="button" accessibilityLabel={`${data.badges} badges. Show all`}>
            <Card style={{ flex: 1 }}>
              <Icon name="medal" size={20} color={colors.warning} />
              <Text style={type.number}>
                {data.badges}
                <Text style={styles.of}>/{BADGES.length}</Text>
              </Text>
              <Text style={type.label}>BADGES</Text>
            </Card>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push('/progress')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.progressRow, pressed && { opacity: 0.8 }]}
        >
          <Icon name="pulse" size={20} color={colors.accent} />
          <Text style={[type.body, { flex: 1, fontWeight: '700' }]}>Progress charts</Text>
          <Text style={styles.meta}>Weight, strength, consistency</Text>
          <Icon name="chevron" size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/records')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.progressRow, pressed && { opacity: 0.8 }]}
        >
          <Icon name="trophy" size={20} color={colors.warning} />
          <Text style={[type.body, { flex: 1, fontWeight: '700' }]}>Personal records</Text>
          <Text style={styles.meta}>Best sets, recent PRs</Text>
          <Icon name="chevron" size={14} color={colors.textMuted} />
        </Pressable>
        {trainedThisWeek && (
          <Pressable onPress={() => share('week')} accessibilityRole="button" style={({ pressed }) => [styles.progressRow, pressed && { opacity: 0.8 }]}>
            <Icon name="share" size={20} color={colors.accent} />
            <Text style={[type.body, { flex: 1, fontWeight: '700' }]}>Share your {weekName}</Text>
            <Text style={styles.meta}>Story-sized recap</Text>
            <Icon name="chevron" size={14} color={colors.textMuted} />
          </Pressable>
        )}
        {trainedThisMonth && (
          <Pressable onPress={() => share('month')} accessibilityRole="button" style={({ pressed }) => [styles.progressRow, pressed && { opacity: 0.8 }]}>
            <Icon name="share" size={20} color={colors.accent} />
            <Text style={[type.body, { flex: 1, fontWeight: '700' }]}>Share your {monthName}</Text>
            <Text style={styles.meta}>Story-sized recap</Text>
            <Icon name="chevron" size={14} color={colors.textMuted} />
          </Pressable>
        )}
        </View>
      }
      ListEmptyComponent={
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Icon name="exercises" size={56} color={colors.border} />
          <Text style={[type.title, { marginTop: space.md }]}>No workouts yet</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', marginTop: space.xs }]}>
            Finish your first workout and it shows up here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.kind === 'cardio') {
          const c = item.cardio;
          const kind = CARDIO_BY_TYPE.get(c.type);
          const effort = EFFORTS.reduce((best, e) => (Math.abs(e.rpe - c.rpe) < Math.abs(best.rpe - c.rpe) ? e : best));
          return (
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.icon}>
                <Icon name={kind?.icon ?? 'pulse'} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={type.title}>{kind?.label}</Text>
                  {c.source === 'strava' && <Text style={styles.strava}>STRAVA</Text>}
                </View>
                <Text style={styles.meta}>
                  {formatDate(c.startedAt)} · {Math.round(c.minutes)} min{c.distance != null ? ` · ${c.distance} ${settings.units === 'kg' ? 'km' : 'mi'}` : ''} · {effort.label}
                </Text>
              </View>
            </Card>
          );
        }
        const w = item.workout;
        return (
          <Pressable
            onPress={() => router.push(`/session/${w.id}`)}
            accessibilityRole="button"
            accessibilityHint="Shows the sets, and lets you do it again"
            style={({ pressed }) => pressed && { opacity: 0.75 }}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.icon}>
                <Icon name="exercises" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={type.title}>{formatDate(w.startedAt)}</Text>
                  <Text style={styles.meta}>{formatDuration(w.startedAt, w.finishedAt)}</Text>
                </View>
                <Text style={styles.meta}>
                  {w.sets} {w.sets === 1 ? 'set' : 'sets'} · {formatNumber(w.volume)} {settings.units} volume
                </Text>
                <Text style={[type.body, { marginTop: space.xs }]} numberOfLines={2}>
                  {w.exercises.split(',').join(', ')}
                </Text>
              </View>
              <Icon name="chevron" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        );
      }}
    />
    <ShareCardSheet
      content={card?.content ?? null}
      onClose={() => setCard(null)}
      title={card?.week ? `Share your ${weekName}` : `Share your ${monthName}`}
      fileName={card?.week ? 'liftlab-week.png' : 'liftlab-month.png'}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  of: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,90,31,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strava: { color: colors.strava, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
});
