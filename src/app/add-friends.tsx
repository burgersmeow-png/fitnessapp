import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/social/Avatar';
import { SectionLabel } from '../components/ui';
import type { Friendship, Profile } from '../lib/social';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import {
  acceptFriend,
  addFriend,
  deleteAccount,
  findPeople,
  loadFriendships,
  loadMyProfile,
  removeFriend,
  signOut,
  SocialError,
} from '../services/social';

function confirm(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

/** Find people, answer requests, manage friends and your account. */
export default function FriendsModal() {
  const insets = useSafeAreaInsets();
  const [data, reload] = useFocusData(async () => {
    const [me, friendships] = await Promise.all([loadMyProfile(), loadFriendships()]);
    return { me, friendships };
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => findPeople(query).then((r) => live && setResults(r), () => {}), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const act = async (work: () => Promise<void>, done?: string) => {
    setNote(null);
    try {
      await work();
      if (done) setNote(done);
      reload();
    } catch (e) {
      setNote(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    }
  };

  const friendships = data?.friendships ?? [];
  const known = new Map(friendships.map((f) => [f.other.id, f]));
  const incoming = friendships.filter((f) => f.incoming && f.status === 'pending');
  const outgoing = friendships.filter((f) => !f.incoming && f.status === 'pending');
  const friends = friendships.filter((f) => f.status === 'accepted');

  const relation = (p: Profile, f: Friendship | undefined) => {
    if (!f) return <SmallButton title="Add" onPress={() => act(() => addFriend(p.id), `Request sent to @${p.username}.`)} />;
    if (f.status === 'accepted') return <Text style={styles.muted}>Friends</Text>;
    if (f.incoming) return <SmallButton title="Accept" onPress={() => act(() => acceptFriend(p.id))} />;
    return <Text style={styles.muted}>Requested</Text>;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <Text style={type.title}>Add friends</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Icon name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }} keyboardShouldPersistTaps="handled">
        {data?.me && <Text style={styles.muted}>Friends can find you as @{data.me.username}</Text>}
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search by username"
          />
        </View>
        {note && <Text style={styles.note}>{note}</Text>}
        {results.map((p) => (
          <Row key={p.id} profile={p} right={relation(p, known.get(p.id))} />
        ))}
        {query.trim().length >= 2 && results.length === 0 && <Text style={styles.muted}>No one with that username yet.</Text>}

        {incoming.length > 0 && <SectionLabel>Requests</SectionLabel>}
        {incoming.map((f) => (
          <Row
            key={f.other.id}
            profile={f.other}
            right={
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <SmallButton title="Accept" onPress={() => act(() => acceptFriend(f.other.id))} />
                <SmallButton title="Decline" quiet onPress={() => act(() => removeFriend(f.other.id))} />
              </View>
            }
          />
        ))}

        <SectionLabel>{`Friends${friends.length ? ` (${friends.length})` : ''}`}</SectionLabel>
        {friends.length === 0 && <Text style={styles.muted}>Search above to add your training partners.</Text>}
        {friends.map((f) => (
          <Row
            key={f.other.id}
            profile={f.other}
            right={
              <SmallButton
                title="Remove"
                quiet
                onPress={() => confirm(`Remove ${f.other.displayName}?`, 'You’ll stop seeing each other’s workouts.', 'Remove', () => act(() => removeFriend(f.other.id)))}
              />
            }
          />
        ))}
        {outgoing.length > 0 && <SectionLabel>Sent</SectionLabel>}
        {outgoing.map((f) => (
          <Row key={f.other.id} profile={f.other} right={<SmallButton title="Cancel" quiet onPress={() => act(() => removeFriend(f.other.id))} />} />
        ))}

        <SectionLabel>Account</SectionLabel>
        <Pressable onPress={() => act(async () => { await signOut(); router.back(); })} accessibilityRole="button" style={styles.accountRow}>
          <Text style={styles.accountText}>Sign out</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            confirm('Delete your account?', 'This removes your profile, friends and everything you shared. Workouts on this phone stay.', 'Delete', () =>
              act(async () => {
                await deleteAccount();
                router.back();
              }),
            )
          }
          accessibilityRole="button"
          style={styles.accountRow}
        >
          <Text style={[styles.accountText, { color: colors.danger }]}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ profile, right }: { profile: Profile; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar profile={profile} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{profile.displayName}</Text>
        <Text style={styles.muted}>@{profile.username}</Text>
      </View>
      {right}
    </View>
  );
}

function SmallButton({ title, onPress, quiet }: { title: string; onPress: () => void; quiet?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.small, quiet && styles.smallQuiet, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.smallText, quiet && { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md },
  muted: { color: colors.textMuted, fontSize: 14 },
  note: { color: colors.success, fontSize: 15, marginBottom: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    marginVertical: space.md,
  },
  searchInput: { flex: 1, minHeight: 46, color: colors.text, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  small: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent },
  smallQuiet: { backgroundColor: colors.surfaceRaised },
  smallText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  accountRow: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  accountText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
