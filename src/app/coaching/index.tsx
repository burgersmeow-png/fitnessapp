import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Avatar } from '../../components/social/Avatar';
import { Button, Card, Loading, SectionLabel } from '../../components/ui';
import { dayLabel, nextAssignment, sortClients, summarizeClient } from '../../lib/coaching';
import { timeAgo } from '../../lib/social';
import { colors, radius, space, type } from '../../lib/theme';
import { useFocusData } from '../../lib/useData';
import {
  endCoaching,
  existingCoachCode,
  joinCoach,
  loadAssignments,
  loadClientSessions,
  loadCoaching,
  myCoachCode,
} from '../../services/coaching';
import { myId, SocialError } from '../../services/social';

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

/** Coaching hub: your coach (as a client) and your clients (as a coach). */
export default function CoachingScreen() {
  const [code, setCode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [data, reload] = useFocusData(async () => {
    const [me, coaching, myCode, assignments] = await Promise.all([myId(), loadCoaching(), existingCoachCode(), loadAssignments()]);
    const sessions = coaching.clients.length ? await loadClientSessions() : [];
    const now = new Date();
    return {
      me,
      ...coaching,
      myCode,
      next: nextAssignment(assignments.filter((a) => a.client === me), now),
      clients: sortClients(coaching.clients.map((c) => summarizeClient(c, sessions, assignments, now))),
    };
  });

  const act = async (work: () => Promise<void>) => {
    setNote(null);
    try {
      await work();
      reload();
    } catch (e) {
      setNote(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    }
  };

  if (!data) return <Loading />;
  const now = new Date();

  const coachSection = (
    <>
      <SectionLabel>Your coach</SectionLabel>
      {data.coach ? (
        <Card>
          <View style={styles.row}>
            <Avatar profile={data.coach} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{data.coach.displayName}</Text>
              <Text style={styles.muted}>@{data.coach.username}</Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/coaching/chat', params: { coach: data.coach!.id, client: data.me, name: data.coach!.displayName } })}
              accessibilityRole="button"
              accessibilityLabel={`Message ${data.coach.displayName}`}
              style={styles.iconButton}
            >
              <Icon name="message" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.muted, { marginTop: space.md }]}>
            {data.next ? `Next from your coach: ${data.next.title} (${dayLabel(data.next.scheduledFor, now)}). It’s on your Today screen.` : 'Workouts your coach sends show up on your Today screen.'}
          </Text>
          <Pressable
            onPress={() => confirm(`Leave ${data.coach!.displayName}?`, 'They’ll stop seeing your sessions, and your plans and messages with them are hidden.', 'Leave', () => act(() => endCoaching(data.coach!.id, data.me)))}
            accessibilityRole="button"
            style={{ marginTop: space.md }}
          >
            <Text style={styles.danger}>Leave coach</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <Text style={styles.body}>Working with a personal trainer? Enter the code they gave you. They’ll see your sessions and can send you workouts.</Text>
          <View style={[styles.row, { marginTop: space.md }]}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              accessibilityLabel="Coach code"
            />
            <Button title="Join" onPress={() => code.trim().length === 6 ? act(() => joinCoach(code)) : setNote('Codes are 6 letters and numbers.')} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
    </>
  );

  const clientsSection = (
    <>
      <SectionLabel>Your clients</SectionLabel>
      {data.myCode ? (
        <>
          <Card style={styles.codeCard}>
            <Text style={styles.muted}>Your coach code</Text>
            <Text style={styles.code} selectable accessibilityLabel={`Your coach code, ${data.myCode.split('').join(' ')}`}>
              {data.myCode}
            </Text>
            <Pressable
              onPress={() => Share.share({ message: `Train with me in LiftLab. Open Friends → Coaching and enter my code: ${data.myCode}` })}
              accessibilityRole="button"
              style={styles.shareButton}
            >
              <Icon name="share" size={18} color={colors.accent} />
              <Text style={styles.link}>Share code</Text>
            </Pressable>
          </Card>
          {data.clients.length === 0 && <Text style={styles.muted}>No clients yet. Share your code to get started.</Text>}
          {data.clients.map((s) => (
            <Pressable
              key={s.client.id}
              onPress={() => router.push(`/coaching/client/${s.client.id}`)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.client, pressed && { opacity: 0.8 }]}
            >
              <Avatar profile={s.client} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.client.displayName}</Text>
                <Text style={styles.muted}>
                  {s.lastSessionAt ? `Last session ${timeAgo(s.lastSessionAt)} ago` : 'No sessions yet'} · {s.sessionsThisWeek} this week
                  {s.due ? ` · plan ${s.done}/${s.due}` : ''}
                </Text>
              </View>
              {s.needsNudge && <Text style={styles.nudge}>Check in</Text>}
              <Icon name="chevron" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </>
      ) : (
        <Card>
          <Text style={styles.body}>
            Personal trainer? Coach clients here: see every session they log, send them workouts, and message them. Free while LiftLab is in testing.
          </Text>
          <Button title="Turn on coach mode" variant="secondary" onPress={() => act(async () => void (await myCoachCode()))} style={{ marginTop: space.md }} />
        </Card>
      )}
    </>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Coaching' }} />
      {note && <Text style={styles.note}>{note}</Text>}

      {/* Coaches see their clients first; everyone else sees their own coach first. */}
      {data.myCode ? (
        <>
          {clientsSection}
          {coachSection}
        </>
      ) : (
        <>
          {coachSection}
          {clientsSection}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  note: { color: colors.warning, fontSize: 15, marginBottom: space.sm },
  danger: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  codeInput: {
    flex: 2,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeCard: { alignItems: 'center', marginBottom: space.md },
  code: { ...type.number, fontSize: 40, letterSpacing: 8, marginVertical: space.sm },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.sm },
  client: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
  },
  nudge: { color: colors.warning, fontSize: 13, fontWeight: '700' },
});
