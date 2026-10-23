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
- **Food**: snap a photo of a meal and get calories, protein, carbs and fat from AI, or search common
  foods and add your own. Daily targets come from your body weight and goal, with a calorie ring and
  macro bars, and today's intake shows on the Today screen
- **Voice coach**: tap the mic on Today and say "30 minute upper body with dumbbells" or "quick leg day"
  to get a matching workout. During a workout, tap the mic and say "8 reps at 100", "2 left in the tank",
  "add 30 seconds" or "what's next". The coach answers out loud and tells you when rest is over.
  Speech comes from the iPhone keyboard's dictation mic, and everything is understood on the phone
- **Cardio**: log runs, rides, rowing, swims and intervals; they count toward muscle recovery
- **History**: workouts and cardio, weekly streak, volume
- **Exercises**: 66 exercises with body-map thumbnails, searchable and filtered by muscle, with a strength trend
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

Photos are estimated by Claude through a small server in `server/food-ai.ts`, so no AI key ever ships
inside the app. Each photo costs roughly one to two US cents in API usage.

To try it on your own phone:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) (it needs a little credit).
2. On your PC, in the project folder (PowerShell):

   ```powershell
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   npm run food-server
   ```

3. Find your PC's Wi-Fi address with `ipconfig` (the IPv4 address, for example `192.168.1.20`) and create
   a file named `.env.local` in the project folder containing:

   ```
   EXPO_PUBLIC_FOOD_AI_URL=http://192.168.1.20:8787
   ```

4. Restart `npx expo start` (with the phone on the same Wi-Fi). "Snap a meal" now works.

Searching foods and adding them by hand work without any of this. For the App Store, the same server runs
on a host (for example Cloudflare, Render or Fly.io) and the URL points there.

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
- `src/lib/nutrition.ts` calorie and macro targets, totals, photo-estimate checks, common foods
- `server/food-ai.ts` the photo estimate server (Claude), with its prompt in `src/lib/foodPrompt.ts`
- `src/components/BodyMap.tsx` the front and back body illustration
- `src/lib/db.ts` SQLite schema and queries
- `src/lib/exercises.ts` built-in exercise library
- `src/lib/theme.ts` colors, type and spacing

## Next

See the plan doc for the full roadmap: Apple Health and Watch, programs, barcode scanning,
Strava and Garmin, always-on voice listening, social features and trainer mode. HealthKit and the Watch
app need a development build through EAS and a paid Apple Developer account.
