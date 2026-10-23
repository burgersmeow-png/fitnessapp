import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import type { RestTimes } from '../lib/restTimes';

const KEY = 'rest-times';

export const loadRestTimes = async (db: SQLiteDatabase): Promise<RestTimes> => (await loadRecord<RestTimes>(db, KEY)) ?? {};
export const saveRestTimes = (db: SQLiteDatabase, times: RestTimes) => saveRecord(db, KEY, Object.keys(times).length ? times : null);
