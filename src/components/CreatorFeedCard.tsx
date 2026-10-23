import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isNew, KIND_LABEL, pinRoute, type Pin } from '../lib/creatorFeed';
import { colors, radius, space, type } from '../lib/theme';
import { useFocusData } from '../lib/useData';
import { loadCreator } from '../services/creatorCode';
import { creatorAlertsOn, creatorAlertsSupported, loadFeed, markPinSeen, turnOnCreatorAlerts } from '../services/creatorFeed';
import { Icon } from './Icon';

const SHOWN = 3;

/** Today's "From Alex" card: what the follower's creator has pinned, newest marked. */
export function CreatorFeedCard() {
  const db = useSQLiteContext();
  const [data, reload] = useFocusData(async () => ({ feed: await loadFeed(db), alerts: await creatorAlertsOn(db), code: (await loadCreator(db))?.code }), []);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const feed = data?.feed;
  if (!feed) return null;

  const open = (pin: Pin) => {
    markPinSeen(db, pin).catch(() => {});
    const to = pinRoute(pin);
    // With the code on it, the screen names the creator ("ALEX’S WORKOUT").
    router.push({ ...to, params: { ...to.params, ...(data?.code ? { code: data.code } : {}) } });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FROM {feed.name.toUpperCase()}</Text>
      {feed.pins.slice(0, all ? undefined : SHOWN).map((pin, i) => (
        <Pressable
          key={pin.payload}
          onPress={() => open(pin)}
          accessibilityRole="button"
          accessibilityLabel={`${KIND_LABEL[pin.kind]}: ${pin.title}${isNew(feed, pin) ? ', new' : ''}`}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.8 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kind}>{KIND_LABEL[pin.kind].toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={1}>{pin.title}</Text>
          </View>
          {isNew(feed, pin) && <Text style={styles.new}>NEW</Text>}
          <Icon name="chevron" size={20} color={colors.textMuted} />
        </Pressable>
      ))}
      {!all && feed.pins.length > SHOWN && (
        <Pressable onPress={() => setAll(true)} accessibilityRole="button" hitSlop={8} style={{ marginTop: space.xs }}>
          <Text style={styles.more}>Show {feed.pins.length - SHOWN} more</Text>
        </Pressable>
      )}
      {creatorAlertsSupported && !data?.alerts && (
        <Pressable
          onPress={async () => {
            setNote(await turnOnCreatorAlerts(db));
            reload();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.alerts, pressed && { opacity: 0.8 }]}
        >
          <Icon name="bell" size={18} color={colors.accent} />
          <Text style={styles.alertsText}>Tell me when {feed.name} posts</Text>
        </Pressable>
      )}
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  eyebrow: { ...type.label, color: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingVertical: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  kind: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  new: { color: colors.accentText, backgroundColor: colors.accent, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  alerts: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, minHeight: 44 },
  alertsText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 14, marginTop: space.xs },
  more: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
