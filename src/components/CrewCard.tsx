import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { creatorCodesAvailable, loadCreator } from '../services/creatorCode';
import { crewThisWeek } from '../services/creatorFeed';
import { joinCrew, leaveCrew, loadCrewBoard, loadCrewName, type CrewPlace } from '../services/crew';
import { confirm } from './confirm';
import { ShareCardSheet } from './ShareCardSheet';
import { crewCardContent } from '../lib/creatorFeed';
import type { CardContent } from '../lib/shareCard';
import { Icon } from './Icon';
import { Button } from './ui';

const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** "Alex's crew": a weekly leaderboard of the creator's followers who joined with a nickname. */
export function CrewCard() {
  const db = useSQLiteContext();
  const [data, reload] = useFocusData(async () => {
    const creator = creatorCodesAvailable() ? await loadCreator(db) : null;
    if (!creator) return null;
    const nickname = await loadCrewName(db);
    return { creator, nickname, board: nickname ? await loadCrewBoard(db) : null, training: nickname ? 0 : await crewThisWeek(db) };
  }, []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardContent | null>(null);
  if (!data) return null;
  const who = data.board?.creatorName ?? data.creator.creatorName;

  const join = async () => {
    setBusy(true);
    setError(await joinCrew(db, name));
    setBusy(false);
    reload();
  };

  if (!data.nickname) {
    if (!open) {
      return (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.card, styles.invite, pressed && { opacity: 0.8 }]}>
          <View style={styles.icon}>
            <Icon name="trophy" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={styles.title}>Join {who}’s crew</Text>
            <Text style={styles.meta}>
              {data.training > 1
                ? `${data.training} people trained with ${who} this week. Join with just a nickname.`
                : `A weekly leaderboard of ${who}’s followers. Just a nickname, no account.`}
            </Text>
          </View>
          <Icon name="chevron" size={20} color={colors.textMuted} />
        </Pressable>
      );
    }
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{who.toUpperCase()}’S CREW</Text>
        <Text style={[styles.meta, { marginTop: space.xs }]}>
          Your nickname and training days this week show to others in the crew. Nothing else does.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="Nickname"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Crew nickname"
          onSubmitEditing={join}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={busy ? 'Joining…' : 'Join the crew'} onPress={busy ? () => {} : join} style={{ marginTop: space.sm }} />
      </View>
    );
  }

  const board = data.board;
  const rows: CrewPlace[] = board ? [...board.top, ...(board.me && !board.top.some((p) => p.me) ? [board.me] : [])] : [];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{who.toUpperCase()}’S CREW · THIS WEEK</Text>
        <Pressable
          onPress={() =>
            confirm(`Leave ${who}’s crew?`, 'Your nickname comes off the leaderboard. You can join again any time.', 'Leave', async () => {
              await leaveCrew(db);
              reload();
            })
          }
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.leave}>Leave</Text>
        </Pressable>
      </View>
      {!board && <Text style={[styles.meta, { marginTop: space.sm }]}>The leaderboard shows when you’re online.</Text>}
      {rows.map((p, i) => (
        <View key={`${p.place}-${p.nickname}-${i}`} style={[styles.row, i > 0 && styles.divider, p.me && styles.mine]}>
          <Text style={[styles.place, p.place === 1 && p.days > 0 && { color: colors.warning }]}>{p.place}</Text>
          <Text style={[styles.name, p.me && { color: colors.accent }]} numberOfLines={1}>
            {p.me ? `${p.nickname} (you)` : p.nickname}
          </Text>
          <Text style={styles.days}>{daysText(p.days)}</Text>
        </View>
      ))}
      {board?.me && board.me.days > 0 && (
        <Pressable
          onPress={() => setCard(crewCardContent(who, board.me!, board.top, board.total))}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.share}
        >
          <Icon name="share" size={18} color={colors.accent} />
          <Text style={styles.shareText}>Share your place</Text>
        </Pressable>
      )}
      <ShareCardSheet content={card} onClose={() => setCard(null)} title="Share your place" fileName="liftlab-crew.png" />
      {board && board.total > rows.filter((p) => p.days > 0).length && (
        <Text style={[styles.meta, { marginTop: space.xs }]}>{board.total} training this week</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  invite: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...type.label, color: colors.accent, flex: 1 },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, minHeight: 44 },
  shareText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  leave: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, color: colors.text, paddingHorizontal: space.md, fontSize: 17, marginTop: space.md },
  error: { color: colors.warning, fontSize: 14, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  mine: { backgroundColor: colors.surfaceRaised, marginHorizontal: -space.sm, paddingHorizontal: space.sm, borderRadius: radius.sm },
  place: { width: 24, color: colors.textMuted, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  days: { color: colors.textMuted, fontSize: 15, fontVariant: ['tabular-nums'] },
});
