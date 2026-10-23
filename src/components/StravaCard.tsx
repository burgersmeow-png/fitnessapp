import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusData } from '../lib/useData';
import { colors, radius, space, TAP } from '../lib/theme';
import {
  connectStrava,
  disconnectStrava,
  loadStravaLink,
  StravaError,
  syncStrava,
} from '../services/strava';
import { Button, Card } from './ui';

function confirm(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title} ${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString();
};

/** Connect, sync and disconnect Strava, shown in Settings. */
export function StravaCard() {
  const db = useSQLiteContext();
  const [link, reload] = useFocusData(() => loadStravaLink(db));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (work: () => Promise<string | null>) => {
    setBusy(true);
    setStatus(null);
    try {
      setStatus(await work());
    } catch (error) {
      setStatus(error instanceof StravaError ? error.message : 'Something went wrong with Strava. Try again.');
    } finally {
      setBusy(false);
      reload();
    }
  };

  const connect = () =>
    run(async () => {
      const linked = await connectStrava(db);
      if (!linked) return null;
      const added = await syncStrava(db);
      return `Connected. Imported ${added} ${added === 1 ? 'activity' : 'activities'} from the last 30 days.`;
    });

  const sync = () =>
    run(async () => {
      const added = await syncStrava(db);
      return added ? `Imported ${added} new ${added === 1 ? 'activity' : 'activities'}.` : 'You’re up to date.';
    });

  if (link === undefined) return null;

  if (!link) {
    return (
      <Card>
        <Text style={styles.body}>
          Bring in your runs, rides and swims so they count toward recovery, and post your lifting sessions to Strava.
        </Text>
        <Pressable
          onPress={connect}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.connect, (pressed || busy) && { opacity: 0.8 }]}
        >
          <Text style={styles.connectText}>{busy ? 'Connecting…' : 'Connect with Strava'}</Text>
        </Pressable>
        {status && <Text style={styles.note}>{status}</Text>}
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.name}>{link.athleteName}</Text>
      </View>
      <Text style={styles.note}>
        {link.lastSyncAt ? `Last synced ${ago(link.lastSyncAt)}.` : 'Not synced yet.'} New activities come in when you open Today.
        {link.canPost ? '' : ' Posting workouts is off because uploads weren’t allowed.'}
      </Text>
      <Button title={busy ? 'Syncing…' : 'Sync now'} variant="secondary" onPress={sync} style={{ marginTop: space.md }} />
      <Pressable
        onPress={() =>
          confirm('Disconnect Strava?', 'Activities already imported stay in your history.', 'Disconnect', () =>
            run(async () => {
              await disconnectStrava(db);
              return null;
            }),
          )
        }
        accessibilityRole="button"
        hitSlop={8}
        style={{ alignSelf: 'center', marginTop: space.md }}
      >
        <Text style={styles.disconnect}>Disconnect</Text>
      </Pressable>
      {status && <Text style={styles.note}>{status}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  connect: {
    minHeight: TAP,
    borderRadius: radius.md,
    backgroundColor: colors.strava,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  connectText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.strava },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  note: { color: colors.textMuted, fontSize: 14, marginTop: space.sm, lineHeight: 19 },
  disconnect: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
