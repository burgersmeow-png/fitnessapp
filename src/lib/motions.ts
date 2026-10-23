// One rep of every exercise as two key poses for the drawn demo figure.
// Angles follow figure.ts: 0 is up, 90 faces forward, 180 is down, 270 is behind.
import type { Motion, Pose } from './figure';

const STAND: Pose = { torso: 0, thigh: 180, shin: 180, arm: 180, fore: 180 };
const FEET = { x: 84, y: 109 };

/** Lying face up on a flat bench, head to the left, feet on the floor. */
const LYING: Pose = { torso: 270, thigh: 105, shin: 185, arm: 0, fore: 0 };
const ON_BENCH = { anchor: 'shoulder' as const, at: { x: 56, y: 78 }, props: [{ kind: 'bench' as const, x1: 34, x2: 100, y: 85 }] };

/** Sitting upright on a bench or machine seat. */
const SEATED: Pose = { torso: 0, thigh: 90, shin: 180, arm: 180, fore: 180 };
const ON_SEAT = { anchor: 'hip' as const, at: { x: 78, y: 85 }, props: [{ kind: 'bench' as const, x1: 62, x2: 92, y: 91 }] };

const squat = (from: Partial<Pose>, to: Partial<Pose>): Pick<Motion, 'anchor' | 'at' | 'from' | 'to'> => ({
  anchor: 'ankle',
  at: FEET,
  from: { ...STAND, torso: 4, ...from },
  to: { ...STAND, torso: 38, thigh: 100, shin: 200, ...to },
});

const hinge = (from: Partial<Pose>, to: Partial<Pose>): Pick<Motion, 'anchor' | 'at' | 'from' | 'to'> => ({
  anchor: 'ankle',
  at: FEET,
  from: { ...STAND, ...from },
  to: { ...STAND, torso: 78, thigh: 165, shin: 190, ...to },
});

const bench = (gear: Motion['gear'], from: Partial<Pose> = {}, to: Partial<Pose> = {}): Motion => ({
  ...ON_BENCH,
  from: { ...LYING, arm: 160, fore: 2, ...from },
  to: { ...LYING, arm: 2, fore: 0, ...to },
  gear,
});

const incline = (gear: Motion['gear']): Motion => ({
  anchor: 'hip',
  at: { x: 80, y: 84 },
  from: { torso: 305, thigh: 95, shin: 180, arm: 175, fore: 15 },
  to: { torso: 305, thigh: 95, shin: 180, arm: 10, fore: 10 },
  gear,
  props: [
    { kind: 'incline', from: { x: 84, y: 90 }, to: { x: 52, y: 66 } },
    { kind: 'bench', x1: 80, x2: 102, y: 90 },
  ],
});

const curl = (gear: Motion['gear']): Motion => ({
  anchor: 'ankle',
  at: FEET,
  from: { ...STAND, arm: 178, fore: 178 },
  to: { ...STAND, arm: 172, fore: 25 },
  gear,
});

const press = (gear: Motion['gear'], seated = false): Motion => {
  const from: Partial<Pose> = { arm: 160, fore: 18 };
  const to: Partial<Pose> = { arm: 2, fore: 0 };
  return seated
    ? { ...ON_SEAT, from: { ...SEATED, ...from }, to: { ...SEATED, ...to }, gear }
    : { anchor: 'ankle', at: FEET, from: { ...STAND, ...from }, to: { ...STAND, ...to }, gear };
};

const row = (gear: Motion['gear'], far?: Partial<Pose>): Motion => ({
  anchor: 'ankle',
  at: FEET,
  from: { ...STAND, torso: 72, thigh: 160, shin: 192, arm: 180, fore: 180, ...far },
  to: { ...STAND, torso: 72, thigh: 160, shin: 192, arm: 245, fore: 175, ...far },
  gear,
});

const calf = (from: Partial<Pose> = {}): Pick<Motion, 'anchor' | 'at' | 'from' | 'to'> => ({
  anchor: 'toe',
  at: { x: 92, y: 111 },
  from: { ...STAND, foot: 0, ...from },
  to: { ...STAND, foot: 45, ...from },
});

/** Front view, standing, for side-to-side movements like lateral raises. */
const FRONT_STAND: Pose = { torso: 0, thigh: 178, shin: 180, arm: 172, fore: 175 };
const FRONT_FEET = { anchor: 'ankle' as const, at: { x: 95, y: 109 }, view: 'front' as const };

const pullUp = (gripOut: number): Motion => ({
  view: 'front',
  anchor: 'hand',
  at: { x: 90 + gripOut, y: 12 },
  from: { torso: 0, thigh: 178, shin: 185, arm: 18, fore: 8 },
  to: { torso: 0, thigh: 170, shin: 200, arm: 110, fore: 340 },
  props: [{ kind: 'bar', x1: 50, x2: 140, y: 12 }],
});

export const MOTIONS: Record<string, Motion> = {
  // Chest
  'bb-bench': bench({ kind: 'barbell' }),
  'bb-incline-bench': incline({ kind: 'barbell' }),
  'db-bench': bench({ kind: 'dumbbell', both: true }),
  'db-incline-bench': incline({ kind: 'dumbbell', both: true }),
  'db-fly': bench({ kind: 'dumbbell', both: true }, { arm: 172, fore: 150 }, { arm: 0, fore: 350 }),
  'machine-chest-press': {
    ...ON_SEAT,
    from: { ...SEATED, arm: 215, fore: 95 },
    to: { ...SEATED, arm: 90, fore: 90 },
    props: [...ON_SEAT.props, { kind: 'incline', from: { x: 70, y: 91 }, to: { x: 70, y: 40 } }, { kind: 'pad', at: 'hand', r: 4 }],
  },
  'pec-deck': {
    ...ON_SEAT,
    view: 'front',
    thighScale: 0.3,
    at: { x: 90, y: 85 },
    from: { ...SEATED, thigh: 150, shin: 180, arm: 95, fore: 10 },
    to: { ...SEATED, thigh: 150, shin: 180, arm: 135, fore: 300 },
    props: [{ kind: 'bench', x1: 76, x2: 104, y: 92 }, { kind: 'pad', at: 'elbow', r: 4 }, { kind: 'pad', at: 'elbowF', r: 4 }],
  },
  'cable-fly': {
    ...FRONT_FEET,
    from: { ...FRONT_STAND, thigh: 172, arm: 70, fore: 80 },
    to: { ...FRONT_STAND, thigh: 172, arm: 150, fore: 220 },
    gear: { kind: 'cable', to: { x: 168, y: 20 }, toF: { x: 22, y: 20 }, both: true },
  },
  'push-up': {
    anchor: 'ankle',
    at: { x: 36, y: 106 },
    from: { torso: 82, thigh: 262, shin: 262, arm: 225, fore: 117, foot: 80 },
    to: { torso: 72, thigh: 252, shin: 252, arm: 180, fore: 180, foot: 80 },
  },
  dip: {
    anchor: 'hand',
    at: { x: 96, y: 58 },
    from: { torso: 2, thigh: 175, shin: 230, arm: 182, fore: 180 },
    to: { torso: 25, thigh: 165, shin: 230, arm: 255, fore: 125 },
    props: [{ kind: 'bar', x1: 82, x2: 112, y: 60 }],
  },
  // Back
  deadlift: {
    ...hinge({ torso: 58, thigh: 122, shin: 200 }, { torso: 0 }),
    from: { ...STAND, torso: 0 },
    to: { ...STAND, torso: 58, thigh: 122, shin: 200 },
    gear: { kind: 'barbell' },
  },
  'bb-row': row({ kind: 'barbell' }),
  'db-row': {
    anchor: 'ankle',
    at: { x: 70, y: 109 },
    from: { ...STAND, torso: 80, thigh: 165, shin: 185, arm: 180, fore: 180, armF: 160, foreF: 175 },
    to: { ...STAND, torso: 80, thigh: 165, shin: 185, arm: 255, fore: 170, armF: 160, foreF: 175 },
    gear: { kind: 'dumbbell' },
    props: [{ kind: 'bench', x1: 98, x2: 140, y: 82 }],
  },
  'pull-up': pullUp(0),
  'chin-up': pullUp(0),
  'lat-pulldown': {
    ...ON_SEAT,
    view: 'front',
    thighScale: 0.3,
    at: { x: 90, y: 85 },
    from: { ...SEATED, thigh: 150, shin: 180, arm: 20, fore: 8 },
    to: { ...SEATED, thigh: 150, shin: 180, arm: 112, fore: 345 },
    props: [{ kind: 'bench', x1: 76, x2: 104, y: 92 }],
    gear: { kind: 'cable', to: { x: 90, y: 4 }, both: true },
  },
  'seated-cable-row': {
    anchor: 'hip',
    at: { x: 58, y: 100 },
    from: { torso: 5, thigh: 92, shin: 110, arm: 90, fore: 90 },
    to: { torso: -5, thigh: 92, shin: 110, arm: 220, fore: 90 },
    gear: { kind: 'cable', to: { x: 150, y: 98 } },
    props: [{ kind: 'bench', x1: 40, x2: 80, y: 105 }],
  },
  'machine-row': {
    ...ON_SEAT,
    from: { ...SEATED, torso: 8, arm: 92, fore: 92 },
    to: { ...SEATED, torso: 8, arm: 230, fore: 92 },
    props: [...ON_SEAT.props, { kind: 'pad', at: 'hand', r: 4 }],
  },
  'kb-swing': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, torso: 70, thigh: 158, shin: 188, arm: 205, fore: 205 },
    to: { ...STAND, torso: -3, arm: 92, fore: 92 },
    gear: { kind: 'kettlebell' },
  },
  'band-pull-apart': {
    ...FRONT_FEET,
    from: { ...FRONT_STAND, arm: 125, fore: 245 },
    to: { ...FRONT_STAND, arm: 92, fore: 92 },
    gear: { kind: 'band', between: true },
  },
  // Shoulders
  ohp: press({ kind: 'barbell' }),
  'db-shoulder-press': press({ kind: 'dumbbell', both: true }, true),
  'machine-shoulder-press': {
    ...press(undefined, true),
    props: [...ON_SEAT.props, { kind: 'incline', from: { x: 70, y: 91 }, to: { x: 70, y: 38 } }, { kind: 'pad', at: 'hand', r: 4 }],
  },
  'db-lateral-raise': {
    ...FRONT_FEET,
    from: { ...FRONT_STAND, arm: 168, fore: 170 },
    to: { ...FRONT_STAND, arm: 88, fore: 85 },
    gear: { kind: 'dumbbell', both: true },
  },
  'cable-lateral-raise': {
    ...FRONT_FEET,
    from: { ...FRONT_STAND, arm: 195, fore: 200 },
    to: { ...FRONT_STAND, arm: 88, fore: 85 },
    gear: { kind: 'cable', to: { x: 40, y: 108 } },
  },
  'face-pull': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, torso: -4, arm: 70, fore: 72 },
    to: { ...STAND, torso: -4, arm: 280, fore: 50 },
    gear: { kind: 'cable', to: { x: 160, y: 28 } },
  },
  'reverse-fly': {
    ...FRONT_FEET,
    lean: 0.55,
    from: { ...FRONT_STAND, thigh: 172, shin: 185, arm: 182, fore: 178 },
    to: { ...FRONT_STAND, thigh: 172, shin: 185, arm: 98, fore: 95 },
    gear: { kind: 'dumbbell', both: true },
  },
  'kb-press': { ...press({ kind: 'kettlebell' }), from: { ...STAND, arm: 165, fore: 15, armF: 180, foreF: 180 }, to: { ...STAND, arm: 2, fore: 0, armF: 180, foreF: 180 } },
  // Arms
  'bb-curl': curl({ kind: 'barbell' }),
  'db-curl': curl({ kind: 'dumbbell', both: true }),
  'hammer-curl': curl({ kind: 'dumbbell', both: true }),
  'cable-curl': curl({ kind: 'cable', to: { x: 140, y: 108 } }),
  'band-curl': curl({ kind: 'band', to: { x: 88, y: 111 } }),
  'close-grip-bench': bench({ kind: 'barbell' }, { arm: 168, fore: 2 }),
  'skull-crusher': bench({ kind: 'barbell' }, { arm: 345, fore: 230 }, { arm: 345, fore: 352 }),
  'triceps-pushdown': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, torso: 8, arm: 175, fore: 45 },
    to: { ...STAND, torso: 8, arm: 175, fore: 175 },
    gear: { kind: 'cable', to: { x: 118, y: 10 } },
  },
  'overhead-triceps-ext': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, arm: 8, fore: 200 },
    to: { ...STAND, arm: 8, fore: 4 },
    gear: { kind: 'dumbbell' },
  },
  'band-pushdown': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, torso: 8, arm: 175, fore: 45 },
    to: { ...STAND, torso: 8, arm: 175, fore: 175 },
    gear: { kind: 'band', to: { x: 118, y: 10 } },
  },
  // Legs
  'back-squat': { ...squat({ arm: 215, fore: 10 }, { arm: 250, fore: 45 }), gear: { kind: 'barbell' } },
  'front-squat': { ...squat({ arm: 80, fore: 262 }, { torso: 22, arm: 100, fore: 282 }), gear: { kind: 'barbell' } },
  rdl: { ...hinge({ arm: 180, fore: 180 }, {}), gear: { kind: 'barbell' } },
  'hip-thrust': {
    anchor: 'shoulder',
    at: { x: 52, y: 80 },
    from: { torso: 300, thigh: 70, shin: 165, arm: 135, fore: 95 },
    to: { torso: 272, thigh: 100, shin: 180, arm: 100, fore: 75 },
    gear: { kind: 'barbell', at: 'hip' },
    props: [{ kind: 'bench', x1: 22, x2: 54, y: 87 }],
  },
  'goblet-squat': { ...squat({ arm: 170, fore: 30 }, { arm: 205, fore: 65 }), gear: { kind: 'dumbbell' } },
  'db-rdl': { ...hinge({}, {}), gear: { kind: 'dumbbell', both: true } },
  'bulgarian-split-squat': {
    anchor: 'ankle',
    at: { x: 98, y: 109 },
    // Rear foot stays on the bench: far-leg angles solved so the ankle lands at (60, 83).
    from: { ...STAND, thigh: 172, shin: 186, thighF: 211, shinF: 267 },
    to: { ...STAND, torso: 12, thigh: 105, shin: 192, thighF: 194, shinF: 328 },
    gear: { kind: 'dumbbell', both: true },
    props: [{ kind: 'bench', x1: 30, x2: 62, y: 88 }],
  },
  'db-lunge': {
    anchor: 'ankle',
    at: { x: 100, y: 109 },
    from: { ...STAND, thigh: 160, shin: 182, thighF: 200, shinF: 200 },
    to: { ...STAND, torso: 4, thigh: 100, shin: 185, thighF: 175, shinF: 262 },
    gear: { kind: 'dumbbell', both: true },
  },
  'leg-press': {
    anchor: 'hip',
    at: { x: 62, y: 92 },
    from: { torso: 290, thigh: 20, shin: 145, arm: 180, fore: 135 },
    to: { torso: 290, thigh: 50, shin: 55, arm: 180, fore: 135 },
    props: [
      { kind: 'incline', from: { x: 66, y: 98 }, to: { x: 30, y: 82 } },
      { kind: 'platform', at: 'ankle', angle: 140 },
    ],
  },
  'hack-squat': {
    ...squat({ torso: 20, arm: 200, fore: 20 }, { torso: 35, arm: 220, fore: 40 }),
    props: [{ kind: 'pad', at: 'shoulder', r: 5 }],
  },
  'leg-extension': {
    ...ON_SEAT,
    from: { ...SEATED, torso: -8, shin: 180, arm: 175, fore: 175 },
    to: { ...SEATED, torso: -8, shin: 95, arm: 175, fore: 175 },
    props: [...ON_SEAT.props, { kind: 'pad', at: 'ankle', r: 4 }],
  },
  'lying-leg-curl': {
    anchor: 'hip',
    at: { x: 82, y: 80 },
    from: { torso: 90, thigh: 268, shin: 268, arm: 150, fore: 150 },
    to: { torso: 90, thigh: 268, shin: 355, arm: 150, fore: 150 },
    props: [{ kind: 'bench', x1: 40, x2: 132, y: 86 }, { kind: 'pad', at: 'ankle', r: 4 }],
  },
  'seated-leg-curl': {
    ...ON_SEAT,
    from: { ...SEATED, torso: -8, shin: 100, arm: 175, fore: 175 },
    to: { ...SEATED, torso: -8, shin: 200, arm: 175, fore: 175 },
    props: [...ON_SEAT.props, { kind: 'pad', at: 'ankle', r: 4 }],
  },
  'cable-pull-through': {
    ...hinge({ torso: 70, thigh: 158, shin: 188, arm: 200, fore: 200 }, { arm: 190, fore: 190 }),
    from: { ...STAND, torso: 70, thigh: 158, shin: 188, arm: 200, fore: 200 },
    to: { ...STAND, arm: 190, fore: 190 },
    gear: { kind: 'cable', to: { x: 28, y: 106 } },
  },
  'kb-goblet-squat': { ...squat({ arm: 170, fore: 30 }, { arm: 205, fore: 65 }), gear: { kind: 'kettlebell' } },
  'bw-squat': squat({ arm: 178, fore: 178 }, { arm: 90, fore: 90 }),
  'glute-bridge': {
    anchor: 'shoulder',
    at: { x: 58, y: 104 },
    from: { torso: 270, thigh: 55, shin: 155, arm: 95, fore: 95 },
    to: { torso: 250, thigh: 75, shin: 165, arm: 105, fore: 95 },
  },
  'band-squat': { ...squat({ arm: 160, fore: 15 }, { arm: 190, fore: 50 }), gear: { kind: 'band', to: { x: 88, y: 111 }, both: true } },
  'standing-calf-raise': { ...calf({ arm: 200, fore: 20 }), props: [{ kind: 'pad', at: 'shoulder', r: 5 }] },
  'seated-calf-raise': {
    ...ON_SEAT,
    anchor: 'toe',
    at: { x: 108, y: 111 },
    from: { ...SEATED, foot: 0, arm: 150, fore: 120 },
    to: { ...SEATED, foot: 40, arm: 150, fore: 120 },
    props: [{ kind: 'bench', x1: 60, x2: 90, y: 91 }, { kind: 'pad', at: 'knee', r: 5 }],
  },
  'db-calf-raise': { ...calf(), gear: { kind: 'dumbbell', both: true } },
  'bw-calf-raise': calf({ thighF: 175, shinF: 250 }),
  // Core
  plank: {
    anchor: 'ankle',
    at: { x: 36, y: 106 },
    from: { torso: 80, thigh: 260, shin: 260, arm: 180, fore: 90, foot: 80 },
    to: { torso: 80, thigh: 260, shin: 260, arm: 180, fore: 90, foot: 80, head: 4 },
  },
  'hanging-leg-raise': {
    anchor: 'hand',
    at: { x: 86, y: 12 },
    from: { torso: 2, thigh: 180, shin: 180, arm: 2, fore: 0 },
    to: { torso: -8, thigh: 85, shin: 95, arm: 2, fore: 0 },
    props: [{ kind: 'bar', x1: 60, x2: 120, y: 12 }],
  },
  'cable-crunch': {
    anchor: 'knee',
    at: { x: 86, y: 108 },
    from: { torso: 15, thigh: 180, shin: 270, arm: 110, fore: 310, foot: 80 },
    to: { torso: 95, thigh: 180, shin: 270, arm: 195, fore: 30, foot: 80 },
    gear: { kind: 'cable', to: { x: 120, y: 6 } },
  },
  'ab-wheel': {
    anchor: 'knee',
    at: { x: 60, y: 108 },
    from: { torso: 65, thigh: 165, shin: 270, arm: 170, fore: 170, foot: 80 },
    to: { torso: 88, thigh: 120, shin: 270, arm: 100, fore: 100, foot: 80 },
    gear: { kind: 'wheel' },
  },
  'pallof-press': {
    anchor: 'ankle',
    at: FEET,
    from: { ...STAND, arm: 200, fore: 70 },
    to: { ...STAND, arm: 92, fore: 90 },
    gear: { kind: 'cable', to: { x: 28, y: 52 } },
  },
  'kb-farmer-carry': {
    anchor: 'hip',
    at: { x: 88, y: 60 },
    from: { ...STAND, thigh: 160, shin: 185, thighF: 200, shinF: 205 },
    to: { ...STAND, thigh: 200, shin: 205, thighF: 160, shinF: 185 },
    gear: { kind: 'kettlebell', both: true },
  },
};
