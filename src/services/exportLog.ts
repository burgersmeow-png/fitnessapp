import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform, Share } from 'react-native';
import { loadExportRows, loadSettings } from '../lib/db';
import { exportFileName, trainingCsv } from '../lib/exportCsv';

/**
 * Hands the training log to the user. The web preview downloads a .csv file; on a phone it
 * opens the share sheet with the CSV text (save it to Files or send it to yourself).
 * Returns the number of sets exported.
 */
export async function exportTrainingLog(db: SQLiteDatabase): Promise<number> {
  const [rows, settings] = await Promise.all([loadExportRows(db), loadSettings(db)]);
  if (rows.length === 0) return 0;
  const csv = trainingCsv(rows, settings.units);
  const name = exportFileName();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ title: name, message: csv });
  }
  return rows.length;
}
