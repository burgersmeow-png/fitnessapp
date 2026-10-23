// Progress photos and the before-and-after story card. Photos never leave the phone
// unless the lifter shares the card themselves. Pure.
import type { CardContent } from './shareCard';

export interface ProgressPhoto {
  id: number;
  takenAt: string;
  /** A data: URI. */
  uri: string;
}

export interface WeighIn {
  measuredAt: string;
  weight: number;
}

const DAY = 864e5;

/** The first and the latest photo, once they are at least a day apart. */
export function beforeAfter<T extends { takenAt: string }>(photos: T[]): { before: T; after: T } | null {
  if (photos.length < 2) return null;
  const sorted = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const before = sorted[0];
  const after = sorted[sorted.length - 1];
  return Date.parse(after.takenAt) - Date.parse(before.takenAt) >= DAY ? { before, after } : null;
}

/** "9 DAYS", "12 WEEKS", "14 MONTHS": the gap between two photos, in the unit that reads best. */
export function spanLabel(fromIso: string, toIso: string): { value: string; label: string } {
  const days = Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY));
  if (days < 14) return { value: String(days), label: days === 1 ? 'DAY' : 'DAYS' };
  if (days < 7 * 26) return { value: String(Math.round(days / 7)), label: 'WEEKS' };
  return { value: String(Math.round(days / 30.4)), label: 'MONTHS' };
}

/** The weigh-in closest to a moment, if one is within a week of it. */
export function weightNear(weights: WeighIn[], iso: string): number | null {
  const t = Date.parse(iso);
  let best: WeighIn | null = null;
  for (const w of weights) {
    const d = Math.abs(Date.parse(w.measuredAt) - t);
    if (d <= 7 * DAY && (!best || d < Math.abs(Date.parse(best.measuredAt) - t))) best = w;
  }
  return best ? best.weight : null;
}

export interface PhotoCardInput {
  before: ProgressPhoto;
  after: ProgressPhoto;
  weights: WeighIn[];
  /** Training days between the two photos. */
  workouts: number;
  units: 'kg' | 'lb';
}

export function photoCardContent(p: PhotoCardInput, locale?: string): CardContent {
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  const span = spanLabel(p.before.takenAt, p.after.takenAt);
  const from = weightNear(p.weights, p.before.takenAt);
  const to = weightNear(p.weights, p.after.takenAt);
  const stats = [span];
  if (p.workouts > 0) stats.push({ value: String(p.workouts), label: p.workouts === 1 ? 'WORKOUT' : 'WORKOUTS' });
  if (from != null && to != null && Math.abs(to - from) >= 0.1) {
    const d = Math.round((to - from) * 10) / 10;
    stats.push({ value: String(Math.abs(d)), label: `${p.units.toUpperCase()} ${d > 0 ? 'UP' : 'DOWN'}` });
  }
  return {
    eyebrow: 'MY PROGRESS',
    headline: `${span.value} ${span.label} APART`,
    stats,
    lines: [],
    more: 0,
    footer: 'Trained with LiftLab',
    photos: { before: { uri: p.before.uri, label: date(p.before.takenAt) }, after: { uri: p.after.uri, label: date(p.after.takenAt) } },
  };
}
