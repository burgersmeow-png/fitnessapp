import type { SQLiteDatabase } from 'expo-sqlite';
import { cleanPins, feedStale, markSeen, mergeFeed, type CreatorFeed, type Pin } from '../lib/creatorFeed';
import { loadRecord, saveRecord } from '../lib/db';
import { loadCreator } from './creatorCode';
import { SERVER_URL } from './server';

const KEY = 'creator-feed';

/**
 * What the creator this phone signed up with has pinned, refreshed at most hourly. null when
 * there's no creator or nothing pinned. Works offline from the last copy.
 */
export async function loadFeed(db: SQLiteDatabase, now = new Date()): Promise<CreatorFeed | null> {
  const creator = await loadCreator(db);
  if (!creator) return null;
  let feed = await loadRecord<CreatorFeed>(db, KEY);
  if (SERVER_URL && feedStale(feed, now)) {
    try {
      const res = await fetch(`${SERVER_URL}/ref/check?code=${encodeURIComponent(creator.code)}`);
      if (res.ok) {
        const body = (await res.json()) as { creatorName?: string; pins?: unknown };
        feed = mergeFeed(feed, body.creatorName ?? creator.creatorName, cleanPins(body.pins), now);
        await saveRecord(db, KEY, feed);
      }
    } catch {
      // Offline: keep showing the last copy.
    }
  }
  return feed && feed.pins.length ? feed : null;
}

export async function markPinSeen(db: SQLiteDatabase, pin: Pin): Promise<void> {
  const feed = await loadRecord<CreatorFeed>(db, KEY);
  if (feed) await saveRecord(db, KEY, markSeen(feed, pin));
}
