// Draws the exercise demo figure. Everything here is pure geometry, so the
// animations are owned by us, weigh nothing, and are testable in Node.
//
// A pose is a set of segment angles in degrees, measured clockwise from
// straight up: 0 is up, 90 points the way the figure faces, 180 is down and
// 270 points behind it. Each angle is the direction from the joint nearer the
// hip to the joint further away (hip to knee, knee to ankle, shoulder to elbow).
import type { Muscle } from './types';

export type View = 'side' | 'front';

export interface Pose {
  torso: number;
  thigh: number;
  shin: number;
  arm: number;
  fore: number;
  /** Far-side limbs (side view) or left limbs (front view); default to the near ones. */
  thighF?: number;
  shinF?: number;
  armF?: number;
  foreF?: number;
  /** Heel lift in degrees, for calf raises. */
  foot?: number;
  head?: number;
}

export type Joint =
  | 'hip' | 'knee' | 'ankle' | 'toe' | 'shoulder' | 'elbow' | 'hand' | 'head'
  | 'kneeF' | 'ankleF' | 'toeF' | 'shoulderF' | 'elbowF' | 'handF';

export type Point = { x: number; y: number };

export type Gear =
  | { kind: 'barbell'; at?: Joint }
  | { kind: 'dumbbell' | 'kettlebell'; both?: boolean }
  | { kind: 'cable' | 'band'; to: Point; both?: boolean; toF?: Point }
  /** A band held between both hands. */
  | { kind: 'band'; between: true }
  | { kind: 'wheel' };

export type Prop =
  | { kind: 'bench'; x1: number; x2: number; y: number }
  | { kind: 'incline'; from: Point; to: Point }
  | { kind: 'bar'; x1: number; x2: number; y: number }
  | { kind: 'pad'; at: Joint; r?: number }
  | { kind: 'platform'; at: Joint; angle: number };

export interface Motion {
  view?: View;
  /** The joint that stays put (feet on the floor, hands on the bar), and where. */
  anchor: Joint;
  at: Point;
  /** Start and end of one rep. */
  from: Pose;
  to: Pose;
  gear?: Gear;
  props?: Prop[];
  /** Front view only: shortens the torso for bent-over lifts. */
  lean?: number;
  /** Front view only: shortens the thighs when seated (they point at the viewer). */
  thighScale?: number;
}

export type Shape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number };

export const VIEWBOX = { width: 180, height: 120 };
export const GROUND = 112;

const LEN = { torso: 32, thigh: 25, shin: 24, arm: 17, fore: 16, neck: 10, foot: 9 };

export const FIGURE_COLORS = {
  body: '#C9CED6',
  bodyFar: '#7D838F',
  muscle: '#FF5A1F',
  muscleFar: '#A8411A',
  gear: '#E9EBEE',
  gearDark: '#4A505B',
  prop: '#3A3F49',
  cable: '#9AA0AB',
  band: '#2FD07A',
  ground: '#2C3038',
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const step = (p: Point, angle: number, len: number): Point => ({
  x: p.x + Math.sin(rad(angle)) * len,
  y: p.y - Math.cos(rad(angle)) * len,
});

/** Smooth start and stop between the two ends of a rep. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Where in the rep we are for a looping clock in [0, 1): a short pause at the
 * start, the lift, a pause at the end, then the return.
 */
export function repProgress(clock: number): number {
  const c = ((clock % 1) + 1) % 1;
  if (c < 0.15) return 0;
  if (c < 0.5) return ease((c - 0.15) / 0.35);
  if (c < 0.65) return 1;
  return 1 - ease((c - 0.65) / 0.35);
}

export function blend(a: Pose, b: Pose, t: number): Pose {
  const mix = (x: number | undefined, y: number | undefined, fx: number, fy: number) =>
    (x ?? fx) + ((y ?? fy) - (x ?? fx)) * t;
  return {
    torso: mix(a.torso, b.torso, 0, 0),
    thigh: mix(a.thigh, b.thigh, 0, 0),
    shin: mix(a.shin, b.shin, 0, 0),
    arm: mix(a.arm, b.arm, 0, 0),
    fore: mix(a.fore, b.fore, 0, 0),
    thighF: mix(a.thighF, b.thighF, a.thigh, b.thigh),
    shinF: mix(a.shinF, b.shinF, a.shin, b.shin),
    armF: mix(a.armF, b.armF, a.arm, b.arm),
    foreF: mix(a.foreF, b.foreF, a.fore, b.fore),
    foot: mix(a.foot, b.foot, 0, 0),
    head: mix(a.head, b.head, 0, 0),
  };
}

/** Joint positions for a side-view pose, with the hip at the origin. */
function sideJoints(p: Pose): Record<Joint, Point> {
  const hip = { x: 0, y: 0 };
  const knee = step(hip, p.thigh, LEN.thigh);
  const ankle = step(knee, p.shin, LEN.shin);
  const kneeF = step(hip, p.thighF ?? p.thigh, LEN.thigh);
  const ankleF = step(kneeF, p.shinF ?? p.shin, LEN.shin);
  const footAngle = 100 + (p.foot ?? 0);
  const shoulder = step(hip, p.torso, LEN.torso);
  const elbow = step(shoulder, p.arm, LEN.arm);
  const elbowF = step(shoulder, p.armF ?? p.arm, LEN.arm);
  return {
    hip,
    knee,
    ankle,
    toe: step(ankle, footAngle, LEN.foot),
    kneeF,
    ankleF,
    toeF: step(ankleF, 100, LEN.foot),
    shoulder,
    elbow,
    hand: step(elbow, p.fore, LEN.fore),
    shoulderF: shoulder,
    elbowF,
    handF: step(elbowF, p.foreF ?? p.fore, LEN.fore),
    head: step(shoulder, p.torso + (p.head ?? 0), LEN.neck),
  };
}

/**
 * Front view: right limbs use the pose angles (90 is out to the side) and the
 * left limbs mirror them. Returns the right side under the plain names and the
 * left side under the "F" names.
 */
function frontJoints(p: Pose, lean: number, thighScale: number): Record<Joint, Point> {
  const hip = { x: 0, y: 0 };
  const hipR = { x: 5, y: 0 };
  const hipL = { x: -5, y: 0 };
  const neck = step(hip, p.torso, LEN.torso * lean);
  const shoulder = { x: neck.x + 10, y: neck.y + 2 };
  const shoulderL = { x: neck.x - 10, y: neck.y + 2 };
  const knee = step(hipR, p.thigh, LEN.thigh * thighScale);
  const kneeF = step(hipL, -(p.thighF ?? p.thigh), LEN.thigh * thighScale);
  const ankle = step(knee, p.shin, LEN.shin);
  const ankleF = step(kneeF, -(p.shinF ?? p.shin), LEN.shin);
  const elbow = step(shoulder, p.arm, LEN.arm);
  const elbowF = step(shoulderL, -(p.armF ?? p.arm), LEN.arm);
  return {
    hip,
    knee,
    ankle,
    toe: { x: ankle.x + 4, y: ankle.y + 1 },
    kneeF,
    ankleF,
    toeF: { x: ankleF.x - 4, y: ankleF.y + 1 },
    shoulder,
    elbow,
    hand: step(elbow, p.fore, LEN.fore),
    shoulderF: shoulderL,
    elbowF,
    handF: step(elbowF, -(p.foreF ?? p.fore), LEN.fore),
    head: step(neck, p.torso + (p.head ?? 0), 9),
  };
}

export function joints(motion: Motion, pose: Pose): Record<Joint, Point> {
  const raw = motion.view === 'front' ? frontJoints(pose, motion.lean ?? 1, motion.thighScale ?? 1) : sideJoints(pose);
  const a = raw[motion.anchor];
  const dx = motion.at.x - a.x;
  const dy = motion.at.y - a.y;
  const out = {} as Record<Joint, Point>;
  for (const k of Object.keys(raw) as Joint[]) out[k] = { x: raw[k].x + dx, y: raw[k].y + dy };
  return out;
}

/** Which body parts glow for the exercise's muscles. */
function lit(primary: Muscle[]) {
  const has = (...m: Muscle[]) => m.some((x) => primary.includes(x));
  return {
    torso: has('chest', 'back', 'core'),
    thigh: has('quads', 'hamstrings', 'glutes'),
    hip: has('glutes'),
    shin: has('calves'),
    arm: has('biceps', 'triceps'),
    fore: false,
    shoulder: has('shoulders'),
  };
}

/** Shapes for one frame, back to front. */
export function drawFigure(motion: Motion, t: number, primary: Muscle[]): Shape[] {
  const pose = blend(motion.from, motion.to, repProgress(t));
  const j = joints(motion, pose);
  const glow = lit(primary);
  const c = FIGURE_COLORS;
  const shapes: Shape[] = [];
  const line = (a: Point, b: Point, width: number, color: string) =>
    shapes.push({ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, width, color });
  const dot = (p: Point, r: number, fill: string, stroke?: string, strokeWidth?: number) =>
    shapes.push({ kind: 'circle', cx: p.x, cy: p.y, r, fill, stroke, strokeWidth });
  const tone = (on: boolean, far: boolean) => (on ? (far ? c.muscleFar : c.muscle) : far ? c.bodyFar : c.body);

  shapes.push({ kind: 'line', x1: 6, y1: GROUND + 1.5, x2: VIEWBOX.width - 6, y2: GROUND + 1.5, width: 1.5, color: c.ground });

  for (const prop of motion.props ?? []) {
    if (prop.kind === 'bench') {
      line({ x: prop.x1, y: prop.y }, { x: prop.x2, y: prop.y }, 5, c.prop);
      line({ x: (prop.x1 + prop.x2) / 2, y: prop.y }, { x: (prop.x1 + prop.x2) / 2, y: GROUND }, 4, c.prop);
    } else if (prop.kind === 'incline') {
      line(prop.from, prop.to, 5, c.prop);
      line({ x: prop.from.x, y: prop.from.y }, { x: prop.from.x, y: GROUND }, 4, c.prop);
    } else if (prop.kind === 'bar') {
      line({ x: prop.x1, y: prop.y }, { x: prop.x2, y: prop.y }, 3, c.prop);
    } else if (prop.kind === 'platform') {
      const p = j[prop.at];
      line(step(p, prop.angle, 10), step(p, prop.angle + 180, 10), 4, c.prop);
    }
  }

  const gear = motion.gear;
  if (gear && 'between' in gear) {
    line(j.hand, j.handF, 2, c.band);
  } else if (gear && (gear.kind === 'cable' || gear.kind === 'band')) {
    const color = gear.kind === 'band' ? c.band : c.cable;
    const width = gear.kind === 'band' ? 2 : 1;
    line(j.hand, gear.to, width, color);
    if (gear.both) line(j.handF, gear.toF ?? gear.to, width, color);
    if (gear.kind === 'cable') {
      dot(gear.to, 3, c.gearDark, c.cable, 1);
      if (gear.toF) dot(gear.toF, 3, c.gearDark, c.cable, 1);
    }
  }

  const side = motion.view !== 'front';
  // Far (or left) limbs first so the near ones overlap them.
  line(j.hip, j.kneeF, 8, tone(glow.thigh, side));
  line(j.kneeF, j.ankleF, 6.5, tone(glow.shin, side));
  line(j.ankleF, j.toeF, 4, side ? c.bodyFar : c.body);
  if (side) {
    line(j.shoulder, j.elbowF, 6, tone(glow.arm, true));
    line(j.elbowF, j.handF, 5, c.bodyFar);
  }

  if (side) {
    line(j.hip, j.shoulder, 13, tone(glow.torso, false));
    if (glow.hip) dot(j.hip, 6.5, c.muscle);
  } else {
    // Front view: hips, trunk and shoulders as a tapered block.
    const chest = { x: (j.shoulder.x + j.shoulderF.x) / 2, y: (j.shoulder.y + j.shoulderF.y) / 2 + 3 };
    line({ x: j.hip.x - 5, y: j.hip.y }, { x: j.hip.x + 5, y: j.hip.y }, 9, tone(glow.hip || glow.thigh, false));
    line(j.hip, chest, 16, tone(glow.torso, false));
    line(j.shoulderF, j.shoulder, 8, tone(glow.torso, false));
    line(j.shoulderF, j.elbowF, 6, tone(glow.arm, false));
    line(j.elbowF, j.handF, 5, c.body);
    if (glow.shoulder) dot(j.shoulderF, 4.5, c.muscle);
  }

  line(j.hip, j.knee, 8.5, tone(glow.thigh, false));
  line(j.knee, j.ankle, 7, tone(glow.shin, false));
  line(j.ankle, j.toe, 4, c.body);
  dot(j.head, 7, c.body);

  const drawGearAt = (p: Point) => {
    if (!gear) return;
    if (gear.kind === 'dumbbell') {
      dot(p, 4.5, c.gear, c.gearDark, 1.5);
    } else if (gear.kind === 'kettlebell') {
      dot({ x: p.x, y: p.y + 6 }, 5.5, c.gearDark, c.gear, 1.5);
    } else if (gear.kind === 'cable') {
      dot(p, 2, c.cable);
    }
  };
  // Barbells sit across both hands, so they go between the far and near arm.
  if (gear?.kind === 'barbell') {
    const p = j[gear.at ?? 'hand'];
    dot(p, 11, c.gearDark, c.gear, 2);
    dot(p, 2.5, c.gear);
  }
  if (gear?.kind === 'wheel') {
    dot({ x: j.hand.x, y: j.hand.y + 1 }, 6, c.gearDark, c.gear, 2);
  }
  if (gear && 'both' in gear && gear.both) drawGearAt(j.handF);

  line(j.shoulder, j.elbow, 6.5, tone(glow.arm, false));
  line(j.elbow, j.hand, 5.5, c.body);
  if (glow.shoulder) dot(j.shoulder, 4.5, c.muscle);
  drawGearAt(j.hand);

  for (const prop of motion.props ?? []) {
    if (prop.kind === 'pad') dot(j[prop.at], prop.r ?? 4, c.prop, c.gearDark, 1);
  }
  return shapes;
}

/** A square box around the drawing, for cropping thumbnails to the figure. */
export function squareBounds(shapes: Shape[], pad = 6): { x: number; y: number; size: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    if (s.kind === 'line') {
      // Skip the floor line, which spans the whole frame.
      if (s.y1 === s.y2 && s.x2 - s.x1 > VIEWBOX.width - 20) continue;
      const h = s.width / 2;
      minX = Math.min(minX, s.x1 - h, s.x2 - h);
      maxX = Math.max(maxX, s.x1 + h, s.x2 + h);
      minY = Math.min(minY, s.y1 - h, s.y2 - h);
      maxY = Math.max(maxY, s.y1 + h, s.y2 + h);
    } else {
      minX = Math.min(minX, s.cx - s.r);
      maxX = Math.max(maxX, s.cx + s.r);
      minY = Math.min(minY, s.cy - s.r);
      maxY = Math.max(maxY, s.cy + s.r);
    }
  }
  const size = Math.max(maxX - minX, maxY - minY) + pad * 2;
  return { x: (minX + maxX) / 2 - size / 2, y: (minY + maxY) / 2 - size / 2, size };
}
