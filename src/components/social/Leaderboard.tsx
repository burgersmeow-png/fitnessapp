import { StyleSheet, Text, View } from 'react-native';
import type { LeaderRow } from '../../lib/social';
import { colors, radius, space } from '../../lib/theme';
import { Avatar } from './Avatar';

const MEDALS = ['🥇', '🥈', '🥉'];

/** This week among friends, ranked by sessions so consistency wins, not just strength. */
export function Leaderboard({ rows, me }: { rows: LeaderRow[]; me: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>THIS WEEK</Text>
      {rows.slice(0, 5).map((r, i) => (
        <View key={r.profile.id} style={[styles.row, r.profile.id === me && styles.meRow]}>
          <Text style={styles.rank}>{r.sessions > 0 ? (MEDALS[i] ?? String(i + 1)) : '–'}</Text>
          <Avatar profile={r.profile} size={30} />
          <Text style={styles.name} numberOfLines={1}>
            {r.profile.id === me ? 'You' : r.profile.displayName}
          </Text>
          <Text style={styles.value}>
            {r.sessions} {r.sessions === 1 ? 'session' : 'sessions'}
          </Text>
        </View>
      ))}
      {rows.length === 1 && <Text style={styles.hint}>Add friends to see how your week compares.</Text>}
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
    marginBottom: space.lg,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, paddingHorizontal: 6, borderRadius: radius.sm },
  meRow: { backgroundColor: colors.surfaceRaised },
  rank: { width: 26, textAlign: 'center', fontSize: 17, color: colors.textMuted, fontWeight: '700' },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  value: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: space.sm },
});
