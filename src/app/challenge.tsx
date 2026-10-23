import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Icon } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { ShareCardSheet } from '../components/ShareCardSheet';
import { Button, Card, Loading, SectionLabel } from '../components/ui';
import { challengeCardContent, challengeProgress, challengeUrl, decodeChallenge, PRESETS, TITLE_MAX, trainingDays, type ChallengeDef } from '../lib/challenge';
import type { CardContent } from '../lib/shareCard';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { joinChallenge, leaveChallenge, loadChallenge } from '../services/challenge';
import { loadBoard, syncChallengeEntry, type Board } from '../services/challengeBoard';
import { loadSessionDates } from '../services/habits';
import { linkWithMyCode } from '../services/creatorCode';
import { SITE_URL } from '../services/server';
import { useLinkCredit } from '../components/useLinkCredit';
import { shareLink } from '../services/shareLink';

const rules = (c: ChallengeDef) => `${trainingDays(c.sessions)} in ${c.days} days. Lifting and cardio both count, once per day.`;

/** Your challenge, or an invite opened from a link (liftlab://challenge?c=…). */
export default function ChallengeScreen() {
  const { c, code } = useLocalSearchParams<{ c?: string; code?: string }>();
  const creator = useLinkCredit(code);
  const db = useSQLiteContext();
  const [card, setCard] = useState<CardContent | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [data, reload] = useFocusData(async () => {
    const [joined, dates] = await Promise.all([loadChallenge(db), loadSessionDates(db)]);
    // Friends' progress is a bonus: offline or signed out, the screen works without it.
    let board: Board | null = null;
    if (joined) {
      await syncChallengeEntry(db).catch(() => {});
      board = await loadBoard(joined).catch(() => null);
    }
    return { joined, dates, invite: decodeChallenge(c), board };
  }, [c]);
  if (!data) return <Loading />;
  const { joined, dates, invite, board } = data;
  const progress = joined ? challengeProgress(joined, dates, new Date()) : null;
  const sameAsInvite = invite && joined && invite.title === joined.title && invite.sessions === joined.sessions && invite.days === joined.days;

  const join = (def: ChallengeDef) => {
    const run = async () => {
      await joinChallenge(db, def);
      await syncChallengeEntry(db).catch(() => {});
      if (invite) router.setParams({ c: undefined });
      reload();
    };
    if (joined && progress?.status === 'active') confirm(`Switch to ${def.title}?`, `You’ll leave ${joined.title}. Day 1 starts today.`, 'Switch', run);
    else run();
  };
  const leave = () =>
    confirm('Leave this challenge?', 'Your workouts stay in History.', 'Leave', async () => {
      await leaveChallenge(db);
      await syncChallengeEntry(db).catch(() => {});
      reload();
    }, true);
  const invitePeople = async (def: ChallengeDef) => {
    setStatus(null);
    try {
      const r = await shareLink(`Join my LiftLab challenge "${def.title}":`, await linkWithMyCode(db, challengeUrl(SITE_URL, def)));
      if (r === 'copied') setStatus('Invite link copied. Paste it in your bio, story or a message.');
    } catch {
      setStatus('Could not share the link.');
    }
  };

  // Opened from someone's invite link.
  if (invite && !sameAsInvite) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
        <Text style={type.label}>{creator ? `${creator.toUpperCase()} INVITED YOU` : 'YOU’RE INVITED'}</Text>
        <Text style={[type.hero, { marginTop: space.xs }]}>{invite.title}</Text>
        <Text style={styles.sub}>{rules(invite)} Day 1 is the day you join.</Text>
        <Button title="Join challenge" onPress={() => join(invite)} style={{ marginTop: space.lg }} />
        {joined && progress?.status === 'active' && <Text style={styles.sub}>You’re in {joined.title}. Joining this one replaces it.</Text>}
        {!router.canGoBack() && (
          <Pressable onPress={() => router.replace('/')} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.lg }}>
            <Text style={styles.notNow}>Not now</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      {joined && progress ? (
        <>
          <Card style={styles.hero}>
            <ProgressRing done={progress.done} total={joined.sessions} size={96} stroke={8} what="sessions" />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.title} numberOfLines={2}>{joined.title}</Text>
              <Text style={styles.meta}>
                {progress.status === 'won'
                  ? 'Done! Every session is in.'
                  : progress.status === 'missed'
                    ? `Ended with ${progress.done} of ${joined.sessions}. Start another?`
                    : `Day ${progress.day} of ${joined.days} · ${progress.onPace ? 'on pace' : 'a little behind'}`}
              </Text>
              <Text style={styles.meta}>{rules(joined)}</Text>
            </View>
          </Card>
          <View style={styles.row}>
            <Button title="Share story" variant="secondary" onPress={() => setCard(challengeCardContent(joined, progress))} style={{ flex: 1 }} />
            <Button title="Invite people" variant="secondary" onPress={() => invitePeople(joined)} style={{ flex: 1 }} />
          </View>
          {status && <Text style={styles.status}>{status}</Text>}
          {board && (
            <>
              <SectionLabel>Friends in this challenge</SectionLabel>
              {!board.signedIn ? (
                <Text style={styles.sub}>Sign in on the Friends tab to see how your friends in this challenge are doing.</Text>
              ) : board.entries.length <= 1 ? (
                <Text style={styles.sub}>No friends in it yet. Tap Invite people and send them the link.</Text>
              ) : (
                <Card>
                  {board.entries.map((e, i) => (
                    <View key={e.userId} style={[styles.boardRow, i > 0 && styles.divider]}>
                      <Text style={styles.place}>{e.place}</Text>
                      <Text style={[styles.boardName, e.me && { color: colors.accent }]} numberOfLines={1}>
                        {e.me ? 'You' : e.name}
                      </Text>
                      <Text style={styles.boardDone}>
                        {e.done}/{joined.sessions}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}
          {progress.status === 'active' && (
            <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md }}>
              <Text style={styles.leave}>Leave challenge</Text>
            </Pressable>
          )}
        </>
      ) : (
        <Text style={styles.sub}>Pick a goal, then invite your followers or friends with a link. Everyone’s progress counts on their own phone.</Text>
      )}

      {(!joined || progress?.status !== 'active') && (
        <>
          <SectionLabel>Start a challenge</SectionLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            placeholder="Name it (optional), e.g. Summer shred"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Challenge name"
          />
          {PRESETS.map((p) => (
            <Pressable
              key={p.title}
              onPress={() => join({ ...p, title: title.trim() || p.title })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.preset, pressed && { opacity: 0.8 }]}
            >
              <Icon name="flame" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.presetTitle}>{p.title}</Text>
                <Text style={styles.meta}>{trainingDays(p.sessions)} in {p.days} days</Text>
              </View>
              <Icon name="chevron" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
        </>
      )}
      {joined && !router.canGoBack() && (
        <Button title="Go to Today" onPress={() => router.replace('/')} style={{ marginTop: space.lg }} />
      )}
      <ShareCardSheet content={card} onClose={() => setCard(null)} title="Share your challenge" fileName="liftlab-challenge.png" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sub: { color: colors.textMuted, fontSize: 15, marginTop: space.sm },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  hero: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  status: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: space.sm },
  notNow: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  place: { width: 24, color: colors.textMuted, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  boardName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  boardDone: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  leave: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, fontSize: 16, marginBottom: space.sm },
  preset: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.sm, minHeight: 64 },
  presetTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
