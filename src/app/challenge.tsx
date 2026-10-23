import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirm } from '../components/confirm';
import { Icon } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { ShareCardSheet } from '../components/ShareCardSheet';
import { Button, Card, Loading, SectionLabel } from '../components/ui';
import { challengeCardContent, challengeProgress, challengeUrl, decodeChallenge, PRESETS, TITLE_MAX, type ChallengeDef } from '../lib/challenge';
import type { CardContent } from '../lib/shareCard';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { joinChallenge, leaveChallenge, loadChallenge } from '../services/challenge';
import { loadSessionDates } from '../services/habits';
import { SITE_URL } from '../services/server';
import { shareLink } from '../services/shareLink';

const rules = (c: ChallengeDef) => `${c.sessions} training days in ${c.days} days. Lifting and cardio both count, once per day.`;

/** Your challenge, or an invite opened from a link (liftlab://challenge?c=…). */
export default function ChallengeScreen() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const db = useSQLiteContext();
  const [card, setCard] = useState<CardContent | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [data, reload] = useFocusData(async () => {
    const [joined, dates] = await Promise.all([loadChallenge(db), loadSessionDates(db)]);
    return { joined, dates, invite: decodeChallenge(c) };
  }, [c]);
  if (!data) return <Loading />;
  const { joined, dates, invite } = data;
  const progress = joined ? challengeProgress(joined, dates, new Date()) : null;
  const sameAsInvite = invite && joined && invite.title === joined.title && invite.sessions === joined.sessions && invite.days === joined.days;

  const join = (def: ChallengeDef) => {
    const run = async () => {
      await joinChallenge(db, def);
      if (invite) router.setParams({ c: undefined });
      reload();
    };
    if (joined && progress?.status === 'active') confirm(`Switch to ${def.title}?`, `You’ll leave ${joined.title}. Day 1 starts today.`, 'Switch', run);
    else run();
  };
  const leave = () =>
    confirm('Leave this challenge?', 'Your workouts stay in History.', 'Leave', async () => {
      await leaveChallenge(db);
      reload();
    }, true);
  const invitePeople = async (def: ChallengeDef) => {
    setStatus(null);
    try {
      const r = await shareLink(`Join my LiftLab challenge "${def.title}":`, challengeUrl(SITE_URL, def));
      if (r === 'copied') setStatus('Invite link copied. Paste it in your bio, story or a message.');
    } catch {
      setStatus('Could not share the link.');
    }
  };

  // Opened from someone's invite link.
  if (invite && !sameAsInvite) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
        <Text style={type.label}>YOU’RE INVITED</Text>
        <Text style={[type.hero, { marginTop: space.xs }]}>{invite.title}</Text>
        <Text style={styles.sub}>{rules(invite)} Day 1 is the day you join.</Text>
        <Button title="Join challenge" onPress={() => join(invite)} style={{ marginTop: space.lg }} />
        {joined && progress?.status === 'active' && <Text style={styles.sub}>You’re in {joined.title}. Joining this one replaces it.</Text>}
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
                <Text style={styles.meta}>{p.sessions} training days in {p.days} days</Text>
              </View>
              <Icon name="chevron" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
        </>
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
  leave: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.md, fontSize: 16, marginBottom: space.sm },
  preset: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.sm, minHeight: 64 },
  presetTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
