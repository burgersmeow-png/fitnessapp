# LiftLab

An iPhone strength training app built with React Native and Expo. It generates each day's workout from your
recovery and equipment, logs sets fast, and raises the weights as you get stronger.

Working name; rename any time in `app.json`.

## What works today

- **Today**: a generated workout that trains your freshest muscles, with a front and back recovery body map
- **Progressive overload**: weights come from a 3-session strength trend, rise when you beat your targets,
  and drop into a deload when a lift stalls
- **Workout**: big tap targets, reps-in-reserve per set, rest timer with haptics, PR detection, end-of-workout
  summary, and the next sets re-weighted on the spot when a set felt easier or harder than planned
- **Food**: snap a photo of a meal and get calories, protein, carbs and fat from AI, scan a packet's
  barcode (free product data from [Open Food Facts](https://openfoodfacts.org), kept on the phone once
  scanned), or search common foods and add your own. Daily targets come from your body weight and goal, with a calorie ring and
  macro bars, and today's intake shows on the Today screen
- **Voice coach**: tap the mic on Today and say "30 minute upper body with dumbbells" or "quick leg day"
  to get a matching workout. During a workout, tap the mic and say "8 reps at 100", "2 left in the tank",
  "add 30 seconds" or "what's next". The coach answers out loud and tells you when rest is over.
  Speech comes from the iPhone keyboard's dictation mic, and everything is understood on the phone
- **Cardio**: log runs, rides, rowing, swims and intervals; they count toward muscle recovery
- **Friends**: add friends by username, see their workouts and runs in a feed, give high-fives and
  comment, and compare the week on a leaderboard ranked by sessions, so consistency wins. Finished
  sessions are shared automatically (switch it off in Settings), and only accepted friends see them
- **Coaching** (Friends → coaching button): personal trainers turn on coach mode and share a code.
  Clients join with it and can leave any time. Coaches get a dashboard of every client (last session,
  sessions this week, plan completion, who needs a check-in), plan workouts for a chosen day, and
  message clients. The client sees the coach's workout on Today, and finishing it ticks it off
- **History**: workouts and cardio, weekly streak, volume
- **Exercises** (from History): 66 exercises with body-map thumbnails, searchable and filtered by muscle, with a strength trend
- **Exercises** also have an animated, drawn demo and step-by-step cues
- **Settings**: goal (strength, muscle, endurance), workout length, your equipment, lb or kg, body weight
  and nutrition goal

Everything is stored on the phone in SQLite, so it works offline.

## Run it on your iPhone from Windows

1. Install [Node.js](https://nodejs.org) (LTS) and [Git](https://git-scm.com/download/win).
2. On your iPhone, install **Expo Go** from the App Store.
3. In a terminal:

   ```bash
   git clone <this repo's URL>
   cd liftlab
   npm install
   npx expo start --tunnel
   ```

4. Scan the QR code with the iPhone camera. The app opens in Expo Go.

`--tunnel` works even when the PC and phone are on different networks. If both are on the same Wi-Fi,
plain `npx expo start` is faster.

To preview in a browser instead, press `w` after `npx expo start`.

## Photo food estimates

Photos are estimated by Claude through the app's small helper server (`server/`), so no AI key ever
ships inside the app. Each photo costs roughly one to two US cents in API usage.

To try it on your own phone:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) (it needs a little credit).
2. On your PC, in the project folder (PowerShell):

   ```powershell
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   npm run server
   ```

3. Find your PC's Wi-Fi address with `ipconfig` (the IPv4 address, for example `192.168.1.20`) and create
   a file named `.env.local` in the project folder containing:

   ```
   EXPO_PUBLIC_SERVER_URL=http://192.168.1.20:8787
   ```

4. Restart `npx expo start` (with the phone on the same Wi-Fi). "Snap a meal" now works.

Searching foods and adding them by hand work without any of this. For the App Store, the same server runs
on a host (for example Cloudflare, Render or Fly.io) and the URL points there.

## Friends and feed

The Friends tab uses a free [Supabase](https://supabase.com) project as its online database. Workouts stay
on the phone; only a summary of each finished session is shared. To set it up (about 10 minutes, free):

1. Sign up at [supabase.com](https://supabase.com) and create a **New project** on the free plan. Pick
   the region closest to you and save the database password somewhere safe.
2. Open **SQL Editor**. For each file in `supabase/migrations/`, oldest first, start a new query, paste
   the whole file, and press **Run**. Today that's `20261023000000_social.sql`,
   `20261023010000_coaching.sql`, `20261023020000_payments.sql`, then `20261023030000_push.sql`.
3. Under **Authentication → Sign In / Providers → Email**, turn off **Confirm email** while you test. The
   free plan only sends a few emails an hour.
4. Open **Connect** (or **Project Settings → API**) and copy the **Project URL** and the **anon** (or
   **publishable**) key into `.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

5. Restart `npx expo start`. The Friends tab now offers sign up.

The anon key is safe to ship in the app: the database's row level security decides what each person can
see. Never put the **service_role** (secret) key in the app. Free projects pause after a week with no use;
press **Restore** in the Supabase dashboard to wake one up.

To check the privacy rules against a test project:
`SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:social` (it creates and deletes throwaway accounts).

## Coach alerts (push notifications)

Coaches and clients get a notification for a new message, a newly assigned workout, and (for coaches) a
client finishing one. Tapping it opens the right screen. It's free: alerts go through Expo's push service.

1. Create a free account at [expo.dev](https://expo.dev), then in the project folder run
   `npx eas-cli@latest init`. It adds your project id to `app.json`, which push needs.
2. Start the server with the Supabase URL and **service_role** key (the same two as for paid coaching):
   `$env:SUPABASE_URL = "..."`, `$env:SUPABASE_SERVICE_ROLE_KEY = "..."`, then `npm run server`.
3. On your iPhone in Expo Go, join a coach (or turn on coach mode) and allow notifications.

Push works in Expo Go on iPhone. Android needs a development build for push. The App Store version will
need an Apple push key, which comes with the paid Apple Developer account.

## Paid coaching (Stripe)

Coaches can charge clients a monthly price. Clients pay on Stripe's own checkout page and the money goes
straight to the coach's bank through Stripe Connect. Stripe has no monthly fee; it takes a cut of each
payment (see [stripe.com/pricing](https://stripe.com/pricing)). Without this setup, coaching simply stays free.

1. Sign up at [stripe.com](https://stripe.com) and stay in **test mode** (no real money moves).
2. Under **Connect**, finish the platform setup and choose **Express** accounts for your coaches.
3. Copy your **secret key** (`sk_test_...`) from **Developers → API keys**.
4. In Supabase, copy the **service_role** key from **Project Settings → API**. It goes on the server only,
   never in the app or `.env.local`.
5. Webhooks need a public address. While testing on your PC, install the
   [Stripe CLI](https://docs.stripe.com/stripe-cli) and run
   `stripe listen --forward-to localhost:8787/pay/webhook --forward-connect-to localhost:8787/pay/webhook`.
   It prints a signing secret (`whsec_...`).
6. Start the server (PowerShell):

   ```powershell
   $env:STRIPE_SECRET_KEY = "sk_test_..."
   $env:STRIPE_WEBHOOK_SECRET = "whsec_..."
   $env:SUPABASE_URL = "https://abcdefgh.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
   npm run server
   ```

7. In the app: **Friends → Coaching**, turn on coach mode, set a price and tap **Set up payouts**. A client
   who joins with your code sees **Subscribe**. Stripe's test card is `4242 4242 4242 4242`.

Optional: `PLATFORM_FEE_PERCENT=10` keeps 10% of each payment for you; the default is 0. Leaving a coach,
or a coach removing a client, stops the subscription straight away. App Store note: Apple lets apps take
payment outside in-app purchase for real person-to-person services such as personal training, but
review decides, so describe the coaching clearly when you submit.

## Strava (switched off for now)

The code to import runs, rides and swims from Strava and to post lifting sessions to Strava is in the
app, but hidden. Since June 2026 Strava requires a paid Strava subscription on the developer's account
to create an API app. To switch it on later:

1. Create an app at [strava.com/settings/api](https://www.strava.com/settings/api). Set
   **Authorization Callback Domain** to your PC's IPv4 address (from `ipconfig`).
2. Start the server with the app's Client ID and Client Secret (PowerShell):

   ```powershell
   $env:STRAVA_CLIENT_ID = "12345"
   $env:STRAVA_CLIENT_SECRET = "..."
   npm run server
   ```

3. Add `EXPO_PUBLIC_STRAVA_ENABLED=1` to `.env.local`, restart `npx expo start`, and use
   **Settings → Connect with Strava**.

## Development

```bash
npm test            # training logic tests (generator, progression)
npm run typecheck   # TypeScript
```

Code layout:

- `src/app/` screens (Expo Router: each file is a route)
- `src/lib/generator.ts` workout generator and muscle recovery model
- `src/lib/figure.ts`, `src/lib/motions.ts` drawn, animated exercise demos (owned, no licence needed)
- `src/lib/progression.ts` training max, overload, stall and deload logic, mid-workout adjustment, PRs
- `src/lib/cardio.ts` cardio types and how they load each muscle
- `src/lib/voice.ts` understands spoken coach commands (offline)
- `src/lib/barcode.ts` barcode checks and Open Food Facts parsing; `src/services/barcode.ts` the lookup
- `src/lib/nutrition.ts` calorie and macro targets, totals, photo-estimate checks, common foods
- `server/` the helper server: meal photo estimates (Claude, prompt in `src/lib/foodPrompt.ts`), Strava sign-in and coach payments (Stripe)
- `src/lib/coaching.ts` client summaries and coach plans; `src/services/coaching.ts` codes, plans, messages
- `src/lib/payments.ts` prices and subscription labels; `src/services/payments.ts` payouts, subscribe, cancel
- `src/lib/habits.ts` weekly goal, streaks, badges, reminder times; `src/lib/programs.ts` training programs
- `src/lib/onboarding.ts` first-run answers to settings and a starting program (`src/app/welcome.tsx`)
- `src/lib/progress.ts` body weight trend, strength per lift, training days per week; `src/components/LineChart.tsx`
- `src/lib/plates.ts` warm-up sets and plates per side of the bar (`src/components/workout/LiftTools.tsx`)
- `src/lib/swap.ts` stand-in lifts for a mid-workout swap (`src/components/workout/SwapSheet.tsx`)
- `src/lib/repeat.ts` past workout to a fresh plan ("Do this workout again" on `src/app/session/[id].tsx`)
- `src/lib/social.ts` feed shapes, leaderboard and titles; `src/services/social.ts` accounts, friends, feed
- `supabase/migrations/` the online database and its privacy rules; `supabase/tests/` checks for those rules
- `src/lib/strava.ts` Strava activity mapping; `src/services/strava.ts` sign-in, sync and posting
- `src/components/BodyMap.tsx` the front and back body illustration
- `src/lib/db.ts` SQLite schema and queries
- `src/lib/exercises.ts` built-in exercise library
- `src/lib/theme.ts` colors, type and spacing

## Next

See the plan doc for the full roadmap: Apple Health and Watch, programs, Garmin, always-on voice listening, and trainer payments and push notifications. HealthKit and the Watch
app need a development build through EAS and a paid Apple Developer account.
