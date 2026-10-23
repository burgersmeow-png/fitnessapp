// Tape-measure tracking: body parts, cm/in conversion and change over time. Pure.

export type BodyPart = 'waist' | 'hips' | 'chest' | 'shoulders' | 'arm' | 'thigh' | 'calf' | 'neck';

export const BODY_PARTS: { value: BodyPart; label: string; how: string }[] = [
  { value: 'waist', label: 'Waist', how: 'At your belly button, relaxed, after breathing out.' },
  { value: 'hips', label: 'Hips', how: 'Around the widest part, over your glutes.' },
  { value: 'chest', label: 'Chest', how: 'Across the nipples, arms down.' },
  { value: 'shoulders', label: 'Shoulders', how: 'Around the widest point, arms down.' },
  { value: 'arm', label: 'Arm', how: 'Biggest point of the upper arm, flexed.' },
  { value: 'thigh', label: 'Thigh', how: 'Biggest point, standing, weight on both feet.' },
  { value: 'calf', label: 'Calf', how: 'Biggest point, standing.' },
  { value: 'neck', label: 'Neck', how: 'Just below the Adam’s apple.' },
];

export const CM_PER_IN = 2.54;

/** Lengths follow the weight units: kg goes with cm, lb with inches. */
export const lengthUnit = (units: 'kg' | 'lb') => (units === 'kg' ? 'cm' : 'in');
export const toCm = (v: number, units: 'kg' | 'lb') => (units === 'kg' ? v : v * CM_PER_IN);
export const fromCm = (cm: number, units: 'kg' | 'lb') => Math.round((units === 'kg' ? cm : cm / CM_PER_IN) * 10) / 10;

/** Rules out typos like 800 or 0.8. */
export function saneLength(cm: number): boolean {
  return Number.isFinite(cm) && cm >= 10 && cm <= 250;
}

export interface Measurement {
  id: number;
  part: BodyPart;
  measuredAt: string;
  /** In the user's length unit. */
  value: number;
}

/** Latest reading per part, and its change since the first reading in the last `days`. */
export function latestByPart(entries: Measurement[], now = Date.now(), days = 90): Map<BodyPart, { value: number; change: number | null }> {
  const out = new Map<BodyPart, { value: number; change: number | null }>();
  const since = now - days * 864e5;
  for (const { value: part } of BODY_PARTS) {
    const list = entries.filter((e) => e.part === part).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    if (!list.length) continue;
    const last = list[list.length - 1];
    const first = list.find((e) => Date.parse(e.measuredAt) >= since);
    const change = first && first.id !== last.id ? Math.round((last.value - first.value) * 10) / 10 : null;
    out.set(part, { value: last.value, change });
  }
  return out;
}
