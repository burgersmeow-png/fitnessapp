import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, loadSettings, saveRecord, saveSettings } from '../lib/db';
import { activeGym, cleanGyms, type Gyms } from '../lib/gyms';

const KEY = 'gyms';

export async function loadGyms(db: SQLiteDatabase): Promise<Gyms> {
  const settings = await loadSettings(db);
  return cleanGyms(await loadRecord(db, KEY), settings.equipment);
}

/** Saves the gyms and copies the active gym's equipment into Settings, which the planner reads. */
export async function saveGyms(db: SQLiteDatabase, gyms: Gyms): Promise<void> {
  await saveRecord(db, KEY, gyms);
  const settings = await loadSettings(db);
  const equipment = activeGym(gyms).equipment;
  if (equipment.join() !== settings.equipment.join()) await saveSettings(db, { ...settings, equipment });
}
