// Warm-up sets and barbell plate maths for the workout screen. Pure.
import type { Equipment } from './types';

export const BAR = { kg: 20, lb: 45 } as const;
export const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] } as const;

/**
 * Plates for each side of the bar, heaviest first, using as few plates as possible.
 * `left` is what couldn't be loaded (e.g. 101 kg on standard plates leaves 1 kg).
 */
export function platesPerSide(total: number, units: 'kg' | 'lb', bar: number = BAR[units]): { plates: number[]; left: number } {
  let side = Math.max(0, (total - bar) / 2);
  const plates: number[] = [];
  for (const p of PLATES[units]) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, left: Math.round(side * 2 * 100) / 100 };
}

/** "20, 10, 2.5" with repeats grouped: "2 × 20, 10". */
export function describePlates(plates: number[]): string {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].map(([p, n]) => (n > 1 ? `${n} × ${p}` : String(p))).join(', ');
}

export interface WarmupSet {
  weight: number | null;
  reps: number;
  /** "Empty bar", "50%" and so on. */
  label: string;
}

const STEP = { barbell: { kg: 2.5, lb: 5 }, other: { kg: 2, lb: 5 } };

/**
 * A short ramp up to the first working weight: enough to groove the movement and warm the
 * joints without tiring you. Lighter work needs fewer steps; bodyweight moves need none.
 */
export function warmupSets(working: number | null, units: 'kg' | 'lb', equipment: Equipment): WarmupSet[] {
  if (working == null || working <= 0 || equipment === 'bodyweight' || equipment === 'bands') return [];
  const barbell = equipment === 'barbell';
  const step = (barbell ? STEP.barbell : STEP.other)[units];
  const floor = barbell ? BAR[units] : step;
  const round = (w: number) => Math.max(floor, Math.round(w / step) * step);
  const ramp: [number, number][] = working >= (units === 'kg' ? 60 : 135) ? [[0.4, 5], [0.6, 3], [0.8, 2]] : [[0.5, 5], [0.75, 3]];
  const out: WarmupSet[] = barbell ? [{ weight: BAR[units], reps: 10, label: 'Empty bar' }] : [];
  for (const [f, reps] of ramp) {
    const w = round(working * f);
    if (w >= working || out.some((s) => s.weight === w)) continue;
    out.push({ weight: w, reps, label: `${Math.round(f * 100)}%` });
  }
  return out;
}
