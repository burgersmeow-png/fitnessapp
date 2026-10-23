// The training log as one JSON document, for backing up to your account and restoring on a
// new phone. Progress photos stay out: they never leave the phone. Pure.

export const BACKUP_TABLES = ['exercises', 'workouts', 'sets', 'cardio', 'food', 'body_weights', 'body_measurements', 'settings'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface Backup {
  v: 1;
  at: string;
  tables: Record<BackupTable, Row[]>;
}

export interface BackupSummary {
  at: string;
  workouts: number;
  sets: number;
  cardio: number;
  meals: number;
}

/** Records that belong to this phone, not to the lifter. */
export const DEVICE_RECORDS = new Set(['install-id']);

const COLUMN = /^[a-z_]{1,40}$/;

export function makeBackup(tables: Record<BackupTable, Row[]>, now: Date): Backup {
  return {
    v: 1,
    at: now.toISOString(),
    tables: {
      ...tables,
      // Built-in exercises ship with the app; only the lifter's own are worth keeping.
      exercises: tables.exercises.filter((r) => r.custom === 1),
      settings: tables.settings.filter((r) => typeof r.key === 'string' && !DEVICE_RECORDS.has(r.key)),
    },
  };
}

export function summarize(b: Backup): BackupSummary {
  return {
    at: b.at,
    workouts: b.tables.workouts.filter((w) => w.finished_at != null).length,
    sets: b.tables.sets.filter((s) => s.completed_at != null).length,
    cardio: b.tables.cardio.length,
    meals: b.tables.food.length,
  };
}

/** A backup read back from the server, or null if it isn't one this app can restore. */
export function parseBackup(raw: unknown): Backup | null {
  const b = raw as Partial<Backup> | null;
  if (!b || b.v !== 1 || typeof b.at !== 'string' || !b.tables || typeof b.tables !== 'object') return null;
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
      for (const [k, v] of Object.entries(r)) {
        if (!COLUMN.test(k)) return null;
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') return null;
      }
    }
    tables[t] = rows as Row[];
  }
  return { v: 1, at: b.at, tables };
}

/** "38 workouts, 1,204 sets" for showing what a backup holds. */
export function summaryLine(s: BackupSummary): string {
  const n = (x: number, one: string, many: string) => `${x.toLocaleString('en-US')} ${x === 1 ? one : many}`;
  const parts = [n(s.workouts, 'workout', 'workouts'), n(s.sets, 'set', 'sets')];
  if (s.cardio) parts.push(n(s.cardio, 'cardio session', 'cardio sessions'));
  if (s.meals) parts.push(n(s.meals, 'meal', 'meals'));
  return parts.join(', ');
}

/** Back up again after this long, when the app opens and something changed. */
export const AUTO_BACKUP_HOURS = 24;

export function backupDue(lastAt: string | null, now: Date): boolean {
  return !lastAt || now.getTime() - Date.parse(lastAt) >= AUTO_BACKUP_HOURS * 36e5;
}
