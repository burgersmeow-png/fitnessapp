// "Beat my workout": comparing a finished session's volume with the target a friend's link set. Pure.
import { compactNumber, type CardContent } from './shareCard';
import type { BeatTarget } from './workoutLink';

const LB_PER_KG = 2.20462;

/** A volume in the other unit, rounded to a whole number. */
export function convertVolume(volume: number, from: 'lb' | 'kg', to: 'lb' | 'kg'): number {
  if (from === to) return Math.round(volume);
  return Math.round(from === 'kg' ? volume * LB_PER_KG : volume / LB_PER_KG);
}

export interface BeatResult {
  /** The target in the lifter's own units. */
  target: number;
  mine: number;
  beaten: boolean;
  /** How far past (beaten) or short of the target, always positive. */
  gap: number;
  /** Share of the target reached, 0 to 100+. */
  percent: number;
}

export function beatResult(target: BeatTarget, mine: number, units: 'lb' | 'kg'): BeatResult {
  const t = Math.max(1, convertVolume(target.volume, target.units, units));
  const m = Math.round(mine);
  return { target: t, mine: m, beaten: m > t, gap: Math.abs(m - t), percent: Math.round((m / t) * 100) };
}

/** One line for the workout summary. */
export function beatLine(r: BeatResult, units: string, who: string | null): string {
  if (r.beaten) return `${r.mine.toLocaleString('en-US')} vs ${r.target.toLocaleString('en-US')} ${units}. You topped ${who ? `${who}’s total` : 'it'} by ${r.gap.toLocaleString('en-US')} ${units}.`;
  if (r.gap === 0) return `${r.mine.toLocaleString('en-US')} ${units}. A dead tie.`;
  return `${r.mine.toLocaleString('en-US')} of ${r.target.toLocaleString('en-US')} ${units} (${r.percent}%). ${r.gap.toLocaleString('en-US')} ${units} to go next time.`;
}

/** The story card for beating someone's workout. */
export function beatCardContent(title: string, r: BeatResult, units: string, who: string | null): CardContent {
  return {
    eyebrow: who ? `BEAT ${who.toUpperCase()}’S WORKOUT` : 'WORKOUT BEATEN',
    headline: title.toUpperCase(),
    stats: [
      { value: compactNumber(r.mine), label: `MY ${units.toUpperCase()}` },
      { value: compactNumber(r.target), label: 'TO BEAT' },
      { value: `+${compactNumber(r.gap)}`, label: units.toUpperCase() },
    ],
    lines: [],
    more: 0,
    footer: 'Think you can top it? Planned and tracked with LiftLab',
  };
}
