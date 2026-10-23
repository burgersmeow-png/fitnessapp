import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { setNote, type LiftNotes } from '../lib/notes';

const KEY = 'lift-notes';

export const loadNotes = async (db: SQLiteDatabase): Promise<LiftNotes> => (await loadRecord<LiftNotes>(db, KEY)) ?? {};

export async function saveNote(db: SQLiteDatabase, exerciseId: string, text: string): Promise<LiftNotes> {
  const notes = setNote(await loadNotes(db), exerciseId, text);
  await saveRecord(db, KEY, notes);
  return notes;
}
