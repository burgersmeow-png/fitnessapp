import type { SQLiteDatabase } from 'expo-sqlite';
import { BACKUP_TABLES, backupDue, DEVICE_RECORDS, makeBackup, parseBackup, summarize, type BackupSummary, type BackupTable, type Row } from '../lib/backup';
import { loadRecord, loadSettings, saveRecord, saveSettings } from '../lib/db';
import { socialConfigured, supabase } from './supabase';

const LAST = 'last-backup';

export const backupAvailable = socialConfigured;

async function signedInUser(): Promise<string | null> {
  if (!socialConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function dump(db: SQLiteDatabase): Promise<Record<BackupTable, Row[]>> {
  const out = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) out[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  return out;
}

/** When this phone last backed up, and what went up. */
export const lastBackup = (db: SQLiteDatabase) => loadRecord<BackupSummary>(db, LAST);

/** Uploads the whole training log to your account, replacing the previous backup. */
export async function backUpNow(db: SQLiteDatabase): Promise<BackupSummary> {
  const userId = await signedInUser();
  if (!userId) throw new Error('Sign in on the Friends tab to back up.');
  const backup = makeBackup(await dump(db), new Date());
  const summary = summarize(backup);
  const { error } = await supabase.from('backups').upsert({ user_id: userId, data: backup, summary, updated_at: backup.at });
  if (error) throw new Error('The backup didn’t upload. Check your connection and try again.');
  await saveRecord(db, LAST, summary);
  return summary;
}

/** Backs up quietly once a day for anyone who has backed up before. Never throws. */
export async function autoBackup(db: SQLiteDatabase): Promise<void> {
  try {
    const last = await lastBackup(db);
    if (!last || !backupDue(last.at, new Date())) return;
    if (await signedInUser()) await backUpNow(db);
  } catch {
    // The next app open tries again.
  }
}

/** What's in the backup on your account, or null when there isn't one. */
export async function cloudBackup(): Promise<BackupSummary | null> {
  if (!(await signedInUser())) return null;
  const { data, error } = await supabase.from('backups').select('summary').maybeSingle();
  if (error) throw new Error('Couldn’t check for a backup. Check your connection and try again.');
  return (data?.summary as BackupSummary | undefined) ?? null;
}

/**
 * Replaces this phone's training log with the backup on your account. Progress photos and
 * this phone's own records are left as they are.
 */
export async function restoreBackup(db: SQLiteDatabase): Promise<BackupSummary> {
  const { data, error } = await supabase.from('backups').select('data').maybeSingle();
  if (error) throw new Error('Couldn’t download the backup. Check your connection and try again.');
  const backup = parseBackup(data?.data);
  if (!backup) throw new Error('There’s no backup on this account yet.');

  await db.withTransactionAsync(async () => {
    const tx = db;
    // Children first, so no set is left pointing at a deleted workout.
    for (const t of ['sets', 'workouts', 'cardio', 'food', 'body_weights', 'body_measurements'] as const) await tx.runAsync(`DELETE FROM ${t}`);
    await tx.runAsync('DELETE FROM exercises WHERE custom = 1');
    const keep = [...DEVICE_RECORDS];
    await tx.runAsync(`DELETE FROM settings WHERE key NOT IN (${keep.map(() => '?').join(', ')})`, ...keep);
    for (const t of ['exercises', 'workouts', 'sets', 'cardio', 'food', 'body_weights', 'body_measurements', 'settings'] as const) {
      // Only columns this version of the app has, so an older or newer backup still restores.
      const cols = new Set((await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name));
      for (const row of backup.tables[t]) {
        if (t === 'settings' && DEVICE_RECORDS.has(String(row.key))) continue;
        const keys = Object.keys(row).filter((k) => cols.has(k));
        if (keys.length === 0) continue;
        await tx.runAsync(
          `INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          ...keys.map((k) => row[k]),
        );
      }
    }
  });
  // Picks up the restored units and goal.
  await saveSettings(db, await loadSettings(db));
  const summary = summarize(backup);
  await saveRecord(db, LAST, summary);
  return summary;
}
