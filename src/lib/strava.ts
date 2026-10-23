// Strava data mapping. Pure: no network or storage here (see src/services/strava.ts).
import type { CardioSession, CardioType } from './cardio';

/** Strava sport types we import, and the cardio type each becomes. Everything else is skipped. */
const SPORT_TO_CARDIO: Record<string, CardioType> = {
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Walk: 'walk',
  Hike: 'walk',
  Ride: 'ride',
  VirtualRide: 'ride',
  MountainBikeRide: 'ride',
  GravelRide: 'ride',
  EBikeRide: 'ride',
  Rowing: 'row',
  VirtualRow: 'row',
  Swim: 'swim',
  Elliptical: 'elliptical',
  StairStepper: 'elliptical',
  HighIntensityIntervalTraining: 'intervals',
  Crossfit: 'intervals',
};

/** The fields of a Strava SummaryActivity that we use. */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  moving_time: number;
  /** Metres. */
  distance: number;
  /** 1 to 10, only when the athlete set it. */
  perceived_exertion?: number | null;
  /** 1 = race for runs, 11 = race for rides. */
  workout_type?: number | null;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  athleteName: string;
  /** False when the athlete unticked "upload activities" on Strava's consent screen. */
  canPost: boolean;
}

/** Turns a Strava activity into a cardio session, or null for sports we don't track (e.g. weight training). */
export function activityToCardio(a: StravaActivity): (CardioSession & { sourceId: string }) | null {
  const type = SPORT_TO_CARDIO[a.sport_type];
  if (!type || a.moving_time < 60) return null;
  const race = a.workout_type === 1 || a.workout_type === 11;
  const rpe = a.perceived_exertion ? Math.min(10, Math.max(1, Math.round(a.perceived_exertion))) : race ? 9 : 5;
  return {
    type,
    startedAt: new Date(a.start_date).toISOString(),
    minutes: Math.round(a.moving_time / 60),
    distance: a.distance > 0 ? Math.round(a.distance / 10) / 100 : null,
    rpe,
    sourceId: `strava:${a.id}`,
  };
}

export interface WorkoutForStrava {
  startedAt: string;
  minutes: number;
  /** In display units, best set first per exercise. */
  exercises: { name: string; sets: number; best: { weight: number | null; reps: number | null } }[];
  units: 'kg' | 'lb';
  prs: string[];
}

/** The body for Strava's "create a manual activity" call. */
export function workoutToActivity(w: WorkoutForStrava) {
  const lines = w.exercises.map((e) => {
    const best = e.best.weight != null && e.best.reps != null ? `, best ${e.best.weight} ${w.units} × ${e.best.reps}` : '';
    return `${e.name}: ${e.sets} ${e.sets === 1 ? 'set' : 'sets'}${best}`;
  });
  if (w.prs.length) lines.push('', `New PRs: ${w.prs.join(', ')} 🏆`);
  const hour = new Date(w.startedAt).getHours();
  const when = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return {
    name: `${when} strength workout`,
    sport_type: 'WeightTraining',
    start_date_local: localIso(new Date(w.startedAt)),
    elapsed_time: Math.max(60, Math.round(w.minutes * 60)),
    description: lines.join('\n'),
  };
}

/** Strava wants the local wall-clock time without an offset. */
function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Reads the tokens the server hands back to the app after sign-in. */
export function tokensFromRedirect(url: string): StravaTokens | { error: string } {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const p = new URLSearchParams(query);
  if (p.get('error')) return { error: p.get('error')! };
  const accessToken = p.get('access_token');
  const refreshToken = p.get('refresh_token');
  const expiresAt = Number(p.get('expires_at'));
  if (!accessToken || !refreshToken || !expiresAt) return { error: 'Strava didn’t return a sign-in.' };
  return {
    accessToken,
    refreshToken,
    expiresAt,
    athleteName: p.get('athlete') ?? 'Strava athlete',
    canPost: (p.get('scope') ?? '').split(',').includes('activity:write'),
  };
}

/** True when the token expires within the next five minutes. */
export const needsRefresh = (t: StravaTokens, nowMs = Date.now()) => t.expiresAt * 1000 - nowMs < 5 * 60_000;
