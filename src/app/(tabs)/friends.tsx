import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { SignInForm, UsernameForm } from '../../components/social/AccountForms';
import { FeedCard } from '../../components/social/FeedCard';
import { Leaderboard } from '../../components/social/Leaderboard';
import { Loading } from '../../components/ui';
import { startOfWeek, weeklyLeaderboard, type FeedPost, type Friendship, type LeaderRow, type Profile } from '../../lib/social';
import { colors, radius, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import { flushShareQueue, loadFeed, loadFriendships, loadMyProfile, setHighFive, SocialError } from '../../services/social';
import { socialConfigured, useSession } from '../../services/supabase';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {!socialConfigured ? (
        <View style={styles.empty}>
          <Text style={type.title}>Friends isn’t set up yet</Text>
          <Text style={styles.muted}>It needs the free online database. See “Friends and feed” in the README.</Text>
        </View>
      ) : session === undefined ? (
        <Loading />
      ) : session === null ? (
        <SignInForm />
      ) : (
        <SignedIn userId={session.user.id} />
      )}
    </View>
  );
}

function SignedIn({ userId }: { userId: string }) {
  const [profile, reload] = useFocusData(() => loadMyProfile().catch(() => 'offline' as const), [userId]);
  if (profile === undefined) return <Loading />;
  if (profile === null) return <UsernameForm onDone={reload} />;
  if (profile === 'offline') return <Offline onRetry={reload} />;
  return <Feed me={profile} />;
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={type.title}>Can’t reach your friends</Text>
      <Text style={styles.muted}>Check your connection. Workouts you finish now are shared when you’re back online.</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: space.md }}>
        <Text style={styles.link}>Try again</Text>
      </Pressable>
    </View>
  );
}

interface FeedData {
  posts: FeedPost[];
  board: LeaderRow[];
  requests: number;
}

function Feed({ me }: { me: Profile }) {
  const db = useSQLiteContext();
  const [refreshing, setRefreshing] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, string[]>>({});
  const [data, reload] = useFocusData<FeedData | 'offline'>(async () => {
    try {
      await flushShareQueue(db);
      const [posts, week, friendships] = await Promise.all([loadFeed(), loadFeed(startOfWeek(new Date()), 1000), loadFriendships()]);
      const friends = friendships.filter((f) => f.status === 'accepted').map((f: Friendship) => f.other);
      return {
        posts,
        board: weeklyLeaderboard(week, [me, ...friends], new Date()),
        requests: friendships.filter((f) => f.incoming && f.status === 'pending').length,
      };
    } catch (e) {
      if (e instanceof SocialError) return 'offline';
      throw e;
    } finally {
      setRefreshing(false);
      setOverrides({});
    }
  }, [me.id]);

  if (data === undefined) return <Loading />;
  if (data === 'offline') return <Offline onRetry={reload} />;

  const highFive = (post: FeedPost, on: boolean) => {
    const current = overrides[post.id] ?? post.highFives;
    setOverrides({ ...overrides, [post.id]: on ? [...current, me.id] : current.filter((id) => id !== me.id) });
    setHighFive(post.id, on).catch(() => setOverrides((o) => ({ ...o, [post.id]: post.highFives })));
  };

  return (
    <FlatList
      data={data.posts}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); reload(); }} tintColor={colors.accent} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={type.hero}>Friends</Text>
            <Pressable onPress={() => router.push('/add-friends')} accessibilityRole="button" accessibilityLabel={`Add friends${data.requests ? `, ${data.requests} requests` : ''}`} style={styles.addButton}>
              <Icon name="addFriend" size={22} color={colors.text} />
              {data.requests > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{data.requests}</Text>
                </View>
              )}
            </Pressable>
          </View>
          {data.requests > 0 && (
            <Pressable onPress={() => router.push('/add-friends')} accessibilityRole="button" style={styles.requests}>
              <Text style={styles.requestsText}>
                {data.requests} friend {data.requests === 1 ? 'request' : 'requests'} waiting
              </Text>
              <Icon name="chevron" size={16} color={colors.accent} />
            </Pressable>
          )}
          <Leaderboard rows={data.board} me={me.id} />
        </>
      }
      renderItem={({ item }) => <FeedCard post={{ ...item, highFives: overrides[item.id] ?? item.highFives }} me={me.id} onHighFive={(on) => highFive(item, on)} />}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', padding: space.lg }}>
          <Text style={[type.title, { textAlign: 'center' }]}>Nothing here yet</Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>Finish a workout to share it, or add friends to see theirs.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, justifyContent: 'center', padding: space.lg },
  muted: { color: colors.textMuted, fontSize: 16, lineHeight: 22, marginTop: space.sm },
  link: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: space.md,
  },
  requestsText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
});
