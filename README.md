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
- **Cardio**: log runs, rides, rowing, swims and intervals; they count toward muscle recovery
- **History**: workouts and cardio, weekly streak, volume
- **Exercises**: 66 exercises with body-map thumbnails, searchable and filtered by muscle, with a strength trend
- **Settings**: goal (strength, muscle, endurance), workout length, your equipment, lb or kg

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

## Development

```bash
npm test            # training logic tests (generator, progression)
npm run typecheck   # TypeScript
```

Code layout:

- `src/app/` screens (Expo Router: each file is a route)
- `src/lib/generator.ts` workout generator and muscle recovery model
- `src/lib/progression.ts` training max, overload, stall and deload logic, mid-workout adjustment, PRs
- `src/lib/cardio.ts` cardio types and how they load each muscle
- `src/components/BodyMap.tsx` the front and back body illustration
- `src/lib/db.ts` SQLite schema and queries
- `src/lib/exercises.ts` built-in exercise library
- `src/lib/theme.ts` colors, type and spacing

## Next

See the plan doc for the full roadmap: Apple Health and Watch, programs and deloads, food tracking,
Strava and Garmin, voice-commanded workouts, social features and trainer mode. HealthKit and the Watch
app need a development build through EAS and a paid Apple Developer account.
