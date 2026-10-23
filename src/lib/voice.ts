// Understands short spoken (dictated) commands for the coach. Pure and offline:
// no AI call, so it is instant, free and works in the gym with no signal.
import type { Equipment, Goal, Muscle } from './types';

export type Command =
  | { kind: 'workout'; focus: Muscle[]; minutes: number | null; equipment: Equipment[] | null; goal: Goal | null; label: string }
  | { kind: 'log'; reps: number | null; weight: number | null; rir: number | null; unit: 'kg' | 'lb' | null }
  | { kind: 'skipRest' }
  | { kind: 'addRest'; seconds: number }
  | { kind: 'next' }
  | { kind: 'finish' }
  | { kind: 'unknown' };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};

/** Lower-cases, strips punctuation and turns number words into digits ("twenty five" → "25"). */
export function normalizeSpeech(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!(w in NUMBER_WORDS)) {
      out.push(w);
      continue;
    }
    let n = NUMBER_WORDS[w];
    // "one hundred and thirty five", "twenty five"
    while (i + 1 < words.length) {
      const next = words[i + 1] === 'and' && words[i + 2] in NUMBER_WORDS ? i + 2 : i + 1;
      const v = NUMBER_WORDS[words[next]];
      if (v === undefined) break;
      if (v === 100) n *= 100;
      else if (n >= 20 && n % 10 === 0 && v < 10) n += v;
      else if (n >= 100 && n % 100 === 0 && v < 100) n += v;
      else break;
      i = next;
    }
    out.push(String(n));
  }
  return out.join(' ');
}

const has = (t: string, ...phrases: string[]) => phrases.some((p) => new RegExp(`\\b${p}\\b`).test(t));

const AREAS: { words: string[]; muscles: Muscle[]; label: string }[] = [
  { words: ['full body', 'whole body', 'everything', 'total body'], muscles: ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'core'], label: 'full body' },
  { words: ['upper body', 'upper'], muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'], label: 'upper body' },
  { words: ['lower body', 'lower', 'legs?', 'leg day'], muscles: ['quads', 'hamstrings', 'glutes', 'calves'], label: 'legs' },
  { words: ['push'], muscles: ['chest', 'shoulders', 'triceps'], label: 'push' },
  { words: ['pull'], muscles: ['back', 'biceps'], label: 'pull' },
  { words: ['arms?', 'guns'], muscles: ['biceps', 'triceps'], label: 'arms' },
  { words: ['chest', 'pecs?'], muscles: ['chest'], label: 'chest' },
  { words: ['back', 'lats?'], muscles: ['back'], label: 'back' },
  { words: ['shoulders?', 'delts?'], muscles: ['shoulders'], label: 'shoulders' },
  { words: ['biceps?', 'bis'], muscles: ['biceps'], label: 'biceps' },
  { words: ['triceps?', 'tris'], muscles: ['triceps'], label: 'triceps' },
  { words: ['quads?', 'quadriceps'], muscles: ['quads'], label: 'quads' },
  { words: ['hamstrings?', 'hammies'], muscles: ['hamstrings'], label: 'hamstrings' },
  { words: ['glutes?', 'bum', 'butt', 'booty'], muscles: ['glutes'], label: 'glutes' },
  { words: ['calf', 'calves'], muscles: ['calves'], label: 'calves' },
  { words: ['abs', 'core', 'stomach'], muscles: ['core'], label: 'core' },
];

const EQUIPMENT_WORDS: { words: string[]; equipment: Equipment[] }[] = [
  { words: ['no equipment', 'bodyweight', 'body weight', 'at home', 'home', 'hotel room'], equipment: ['bodyweight', 'bands'] },
  { words: ['dumbbells?', 'dbs?'], equipment: ['dumbbell'] },
  { words: ['barbells?'], equipment: ['barbell'] },
  { words: ['kettlebells?'], equipment: ['kettlebell'] },
  { words: ['bands?', 'resistance bands?'], equipment: ['bands'] },
  { words: ['machines?'], equipment: ['machine'] },
  { words: ['cables?'], equipment: ['cable'] },
];

function parseWorkout(t: string): Command | null {
  const asksForWorkout = has(t, 'workout', 'session', 'day', 'routine', 'train', 'training', 'give me', 'build', 'make', 'plan', 'hit', 'do', 'want', 'lets');
  const focus: Muscle[] = [];
  const labels: string[] = [];
  for (const area of AREAS) {
    if (!has(t, ...area.words)) continue;
    // "upper back" is the back, not the whole upper body.
    if (area.label === 'upper body' && has(t, 'upper back')) continue;
    if (area.label === 'legs' && has(t, 'lower back')) continue;
    labels.push(area.label);
    for (const m of area.muscles) if (!focus.includes(m)) focus.push(m);
  }
  let minutes: number | null = null;
  const m = t.match(/(\d+)\s*(min|mins|minute|minutes)\b/);
  if (m) minutes = Number(m[1]);
  else if (has(t, 'half an hour', 'half hour')) minutes = 30;
  else if (has(t, 'an hour', 'one hour', '1 hour')) minutes = 60;
  else if (has(t, 'quick', 'short', 'fast')) minutes = 20;
  let equipment: Equipment[] | null = null;
  for (const e of EQUIPMENT_WORDS) {
    if (has(t, ...e.words)) equipment = [...new Set([...(equipment ?? []), ...e.equipment])];
  }
  if (equipment && !equipment.includes('bodyweight')) equipment.push('bodyweight');
  const goal: Goal | null = has(t, 'heavy', 'strength', 'strong')
    ? 'strength'
    : has(t, 'endurance', 'burn', 'high reps', 'light', 'conditioning')
      ? 'endurance'
      : has(t, 'pump', 'hypertrophy', 'size', 'muscle')
        ? 'hypertrophy'
        : null;
  if (focus.length === 0 && !(asksForWorkout && (minutes || equipment || goal))) return null;
  return { kind: 'workout', focus, minutes, equipment, goal, label: labels.join(' and ') || 'full body' };
}

function parseLog(t: string): Command | null {
  const unit = has(t, 'kg', 'kgs', 'kilo', 'kilos', 'kilograms?') ? 'kg' : has(t, 'lb', 'lbs', 'pounds?') ? 'lb' : null;
  const rirMatch = t.match(/(\d+)\s*(left|in the tank|in reserve|rir|more)\b/);
  const rir = rirMatch ? Number(rirMatch[1]) : has(t, 'failure', 'max effort') ? 0 : null;
  const rest = rirMatch ? t.replace(rirMatch[0], ' ') : t;
  let reps: number | null = null;
  let weight: number | null = null;
  // "8 reps at 100", "8 at 100", "100 for 8", "100 kg 8 reps", "8 reps"
  const repsAt = rest.match(/(\d+)\s*(?:reps?|times)?\s*(?:at|with|of|@)\s*(\d+(?:\.\d+)?)/);
  const weightFor = rest.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?|lbs?|pounds?)?\s*(?:for|x|by|times)\s*(\d+)/);
  const repsOnly = rest.match(/(\d+)\s*(?:reps?|times)\b/);
  if (repsAt) {
    reps = Number(repsAt[1]);
    weight = Number(repsAt[2]);
  } else if (weightFor) {
    weight = Number(weightFor[1]);
    reps = Number(weightFor[2]);
  } else if (repsOnly) {
    reps = Number(repsOnly[1]);
    const w = rest.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?|lbs?|pounds?)\b/);
    if (w) weight = Number(w[1]);
  }
  const done = has(t, 'done', 'finished that', 'got it', 'complete', 'completed', 'log it', 'log that', 'did it', 'easy', 'that set');
  if (reps == null && weight == null && rir == null && !done) return null;
  if (reps != null && (reps <= 0 || reps > 100)) reps = null;
  return { kind: 'log', reps, weight, rir, unit };
}

/** Turns one dictated phrase into a command for the coach. */
export function parseCommand(text: string): Command {
  const t = normalizeSpeech(text);
  if (!t) return { kind: 'unknown' };
  if (has(t, 'skip rest', 'skip the rest', 'skip', 'ready', 'start next set', 'lets go')) {
    if (!has(t, 'workout', 'session')) return { kind: 'skipRest' };
  }
  const more = t.match(/(?:add|more|extra|another)\s*(\d+)?\s*(sec|secs|second|seconds|minute|minutes|min)?/);
  if (more && (has(t, 'rest', 'seconds?', 'minutes?', 'secs?') || has(t, 'more time'))) {
    const minutes = more[2]?.startsWith('min');
    const n = more[1] ? Number(more[1]) : minutes ? 1 : 30;
    return { kind: 'addRest', seconds: minutes ? n * 60 : n };
  }
  if (has(t, 'finish workout', 'end workout', 'finish the workout', 'im done for today', 'wrap up', 'end session')) return { kind: 'finish' };
  if (has(t, 'whats next', 'what is next', 'next exercise', 'whats left', 'how many left')) return { kind: 'next' };
  return parseWorkout(t) ?? parseLog(t) ?? { kind: 'unknown' };
}

/** Example phrases shown under the coach input. */
export const EXAMPLES = {
  idle: ['30 minute upper body with dumbbells', 'Quick leg day', 'Heavy push workout', 'Full body, no equipment'],
  workout: ['8 reps at 100', 'Done, 2 left in the tank', 'Add 30 seconds', 'What’s next?'],
};
