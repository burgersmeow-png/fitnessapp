import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../../components/Icon';
import { FeedCard } from '../../../components/social/FeedCard';
import { Button, Card, Loading, SectionLabel } from '../../../components/ui';
import { dayLabel, localDate, summarizeClient } from '../../../lib/coaching';
import { EXERCISES_BY_ID } from '../../../lib/exercises';
import { timeAgo } from '../../../lib/social';
import { colors, space, type } from '../../../lib/theme';
import { useFocusData } from '../../../lib/useData';
import { endCoaching, loadAssignments, loadClientSessions, loadCoaching, removeAssignment } from '../../../services/coaching';
import { myId, setHighFive, SocialError } from '../../../services/social';

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

/** A coach's view of one client: progress, plan, sessions. */
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<string | null>(null);
  const [data, reload] = useFocusData(async () => {
    const [me, coaching, assignments, sessions] = await Promise.all([myId(), loadCoaching(), loadAssignments(id), loadClientSessions()]);
    const client = coaching.clients.find((c) => c.id === id) ?? null;
    return { me, client, assignments, sessions: sessions.filter((p) => p.author.id === id) };
  }, [id]);

  if (!data) return <Loading />;
  const { me, client, assignments, sessions } = data;
  if (!client) {
    return (
      <View style={[styles.screen, { padding: space.lg }]}>
        <Text style={type.title}>No longer your client</Text>
      </View>
    );
  }
  const now = new Date();
  const s = summarizeClient(client, sessions, assignments, now);
  const today = localDate(now);
  const upcoming = assignments.filter((a) => a.scheduledFor >= today && !a.completedAt).reverse();
  const past = assignments.filter((a) => a.scheduledFor < today || a.completedAt).slice(0, 10);

  const act = async (work: () => Promise<void>) => {
    setNote(null);
    try {
      await work();
      reload();
    } catch (e) {
      setNote(e instanceof SocialError ? e.message : 'Something went wrong. Try again.');
    }
  };

  const assignmentRow = (a: (typeof assignments)[number], removable: boolean) => (
    <View key={a.id} style={styles.assignment}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{a.title}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {dayLabel(a.scheduledFor, now)} · {a.plan.map((p) => EXERCISES_BY_ID.get(p.exerciseId)?.name ?? p.exerciseId).join(', ')}
        </Text>
      </View>
      {a.completedAt ? (
        <Text style={styles.done}>Done ✓</Text>
      ) : a.scheduledFor < today ? (
        <Text style={styles.missed}>Missed</Text>
      ) : null}
      {removable && (
        <Pressable onPress={() => act(() => removeAssignment(a.id))} accessibilityRole="button" accessibilityLabel={`Remove ${a.title}`} hitSlop={10}>
          <Icon name="trash" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
      <Stack.Screen options={{ title: client.displayName }} />
      <View style={styles.stats}>
        <Stat value={String(s.sessionsThisWeek)} label="THIS WEEK" />
        <Stat value={s.lastSessionAt ? timeAgo(s.lastSessionAt) : '–'} label="LAST SESSION" />
        <Stat value={s.due ? `${Math.round((s.done / s.due) * 100)}%` : '–'} label="PLAN DONE" />
      </View>
      {s.needsNudge && <Text style={styles.nudge}>{s.done < s.due ? 'Missed a planned workout recently.' : 'No sessions in 5 days.'} A quick message helps.</Text>}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Button title="Plan workout" onPress={() => router.push({ pathname: '/coaching/assign', params: { client: client.id, name: client.displayName } })} style={{ flex: 1 }} />
        <Button
          title="Message"
          variant="secondary"
          onPress={() => router.push({ pathname: '/coaching/chat', params: { coach: me, client: client.id, name: client.displayName } })}
          style={{ flex: 1 }}
        />
      </View>
      {note && <Text style={styles.nudge}>{note}</Text>}

      <SectionLabel>Planned</SectionLabel>
      {upcoming.length === 0 ? <Text style={styles.muted}>Nothing planned. Assign a workout for today or later.</Text> : upcoming.map((a) => assignmentRow(a, true))}
      {past.length > 0 && <SectionLabel>Recent plans</SectionLabel>}
      {past.map((a) => assignmentRow(a, false))}

      <SectionLabel>Sessions (30 days)</SectionLabel>
      {sessions.length === 0 && <Text style={styles.muted}>No sessions logged yet.</Text>}
      {sessions.map((p) => (
        <FeedCard key={p.id} post={p} me={me} onHighFive={(on) => act(() => setHighFive(p.id, on))} />
      ))}

      <Pressable
        onPress={() => confirm(`Stop coaching ${client.displayName}?`, 'You’ll stop seeing their sessions, and your plans and messages are hidden.', 'Stop coaching', () => act(async () => { await endCoaching(me, client.id); router.back(); }))}
        accessibilityRole="button"
        style={{ alignSelf: 'center', marginTop: space.lg }}
      >
        <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>Stop coaching</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type.number, { fontSize: 24 }]}>{value}</Text>
      <Text style={[type.label, { fontSize: 11 }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  stats: { flexDirection: 'row', gap: space.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  nudge: { color: colors.warning, fontSize: 14, marginTop: space.sm },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  done: { color: colors.success, fontSize: 14, fontWeight: '700' },
  missed: { color: colors.warning, fontSize: 14, fontWeight: '700' },
});
