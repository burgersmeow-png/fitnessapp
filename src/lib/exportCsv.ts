// The training log as a CSV file that opens in any spreadsheet. Pure.

export interface ExportRow {
  date: string; // ISO timestamp the set was completed
  exercise: string;
  set: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
}

/** Quotes a cell when it holds a comma, quote or line break, per RFC 4180. */
export function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function trainingCsv(rows: ExportRow[], units: 'kg' | 'lb'): string {
  const head = ['Date', 'Time', 'Exercise', 'Set', `Weight (${units})`, 'Reps', 'Reps in reserve'];
  const lines = rows.map((r) => {
    const d = new Date(r.date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return [day, time, r.exercise, r.set, r.weight, r.reps, r.rir].map(csvCell).join(',');
  });
  return [head.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}

export const exportFileName = (now = new Date()) => `liftlab-training-${now.toISOString().slice(0, 10)}.csv`;
