import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityToCardio, needsRefresh, tokensFromRedirect, workoutToActivity, type StravaActivity } from './strava';

const run: StravaActivity = {
  id: 42, name: 'Morning Run', sport_type: 'TrailRun', start_date: '2026-10-20T06:00:00Z',
  moving_time: 1830, distance: 5012.4,
};

test('strava runs become cardio with km, minutes and a default effort', () => {
  assert.deepEqual(activityToCardio(run), {
    type: 'run', startedAt: '2026-10-20T06:00:00.000Z', minutes: 31, distance: 5.01, rpe: 5, sourceId: 'strava:42',
  });
  assert.equal(activityToCardio({ ...run, workout_type: 1 })!.rpe, 9);
  assert.equal(activityToCardio({ ...run, perceived_exertion: 7.4 })!.rpe, 7);
});

test('strava activities we do not track are skipped', () => {
  assert.equal(activityToCardio({ ...run, sport_type: 'WeightTraining' }), null);
  assert.equal(activityToCardio({ ...run, sport_type: 'Yoga' }), null);
  assert.equal(activityToCardio({ ...run, moving_time: 20 }), null);
  assert.equal(activityToCardio({ ...run, sport_type: 'Elliptical', distance: 0 })!.distance, null);
});

test('a finished workout becomes a strava weight training activity', () => {
  const a = workoutToActivity({
    startedAt: new Date(2026, 9, 20, 18, 5).toISOString(),
    minutes: 52,
    units: 'lb',
    prs: ['Back Squat'],
    exercises: [
      { name: 'Back Squat', sets: 3, best: { weight: 225, reps: 5 } },
      { name: 'Plank', sets: 1, best: { weight: null, reps: null } },
    ],
  });
  assert.equal(a.sport_type, 'WeightTraining');
  assert.equal(a.name, 'Evening strength workout');
  assert.equal(a.start_date_local, '2026-10-20T18:05:00');
  assert.equal(a.elapsed_time, 3120);
  assert.equal(a.description, 'Back Squat: 3 sets, best 225 lb × 5\nPlank: 1 set\n\nNew PRs: Back Squat 🏆');
});

test('sign-in redirect is read into tokens, and errors are passed on', () => {
  const t = tokensFromRedirect('exp://192.168.1.20:8081/--/strava?access_token=a&refresh_token=r&expires_at=2000000000&athlete=Sam%20R&scope=read,activity:read_all,activity:write');
  assert.deepEqual(t, { accessToken: 'a', refreshToken: 'r', expiresAt: 2000000000, athleteName: 'Sam R', canPost: true });
  assert.equal((tokensFromRedirect('liftlab://strava?access_token=a&refresh_token=r&expires_at=1&scope=read') as { canPost: boolean }).canPost, false);
  assert.deepEqual(tokensFromRedirect('liftlab://strava?error=access_denied'), { error: 'access_denied' });
  assert.ok('error' in tokensFromRedirect('liftlab://strava'));
  assert.equal(needsRefresh(t as never, 2000000000 * 1000 - 60_000), true);
  assert.equal(needsRefresh(t as never, 2000000000 * 1000 - 3600_000), false);
});
