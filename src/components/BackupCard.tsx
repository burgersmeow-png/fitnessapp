import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { summaryLine, type BackupSummary } from '../lib/backup';
import { formatDate } from '../lib/format';
import { colors, space } from '../lib/theme';
import { backUpNow, cloudBackup, lastBackup, restoreBackup } from '../services/backup';
import { useSession } from '../services/supabase';
import { confirm } from './confirm';
import { Button } from './ui';

/** Back up the training log to your account, and bring it back on a new phone. */
export function BackupCard({ onRestored }: { onRestored: () => void }) {
  const db = useSQLiteContext();
  const session = useSession();
  const [last, setLast] = useState<BackupSummary | null>(null);
  const [cloud, setCloud] = useState<BackupSummary | null>(null);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    lastBackup(db).then(setLast).catch(() => {});
    if (session) cloudBackup().then(setCloud).catch(() => {});
  }, [db, session]);

  if (session === undefined) return null;
  if (!session) {
    return (
      <View>
        <Button title="Sign in to back up" variant="secondary" onPress={() => router.push('/friends')} />
        <Text style={styles.note}>Your training lives on this phone. Sign in and it’s backed up to your account, ready for a new phone.</Text>
      </View>
    );
  }

  const backUp = async () => {
    setBusy('backup');
    setNote(null);
    try {
      const s = await backUpNow(db);
      setLast(s);
      setCloud(s);
      setNote(`Backed up ${summaryLine(s)}.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const restore = () =>
    confirm(
      'Replace this phone’s training?',
      `Everything on this phone (except progress photos) is replaced by the backup: ${cloud ? summaryLine(cloud) : ''}.`,
      'Restore',
      async () => {
        setBusy('restore');
        setNote(null);
        try {
          const s = await restoreBackup(db);
          setLast(s);
          setNote(`Restored ${summaryLine(s)}.`);
          onRestored();
        } catch (e) {
          setNote((e as Error).message);
        } finally {
          setBusy(null);
        }
      },
      true,
    );

  // Offer restore first on a phone that has never backed up but finds a backup on the account.
  const fresh = !last && cloud;
  return (
    <View style={{ gap: space.sm }}>
      {fresh ? (
        <Button title={busy === 'restore' ? 'Restoring…' : 'Restore your backup'} onPress={busy ? () => {} : restore} />
      ) : (
        <Button title={busy === 'backup' ? 'Backing up…' : 'Back up now'} variant="secondary" onPress={busy ? () => {} : backUp} />
      )}
      <Text style={styles.note}>
        {note ??
          (last
            ? `Last backup ${formatDate(last.at)}: ${summaryLine(last)}. It backs up again each day you open the app.`
            : cloud
              ? `Your account has a backup from ${formatDate(cloud.at)}: ${summaryLine(cloud)}.`
              : 'Back up your workouts, cardio, food and body weight to your account. Progress photos stay on this phone.')}
      </Text>
      {!fresh && cloud && (
        <Text style={styles.link} onPress={busy ? undefined : restore} accessibilityRole="button">
          Restore from backup
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
