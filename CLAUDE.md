# LiftLab: project rules

Read `AGENTS.md` too (Expo-specific rules: versioned docs, `npx expo install`, Expo Router).

## Stack

- React Native + Expo SDK 58, TypeScript (strict), Expo Router. Developed on Windows; iOS builds via EAS.
- Local-first: `expo-sqlite`. Weights stored in kg and distances in km; convert only in `src/lib/db.ts`.
- Minimum iOS 16 (Expo SDK 58 floor). iPhone first; iPad not supported yet.
- Runs in Expo Go until a feature needs native code (HealthKit, Watch, Live Activities). Those need an EAS
  development build and a paid Apple Developer account; flag it before adding one.

## Architecture

- `src/app/` screens only (each file is a route). `src/components/` shared UI. `src/lib/` logic and data.
- Training logic in `src/lib/` is pure TypeScript with no React or Expo imports, and is unit tested
- Exercise demos are drawn in code, not filmed: `src/lib/figure.ts` (geometry) and `src/lib/motions.ts`
  (two key poses per exercise). Coaching cues live in `src/lib/exerciseGuide.ts`. Do not add
  third-party exercise photos or videos without a licence that allows commercial app use.
  (`npm test`). Screens call it; it never calls screens.
- One feature per screen file; extract a component when a screen passes ~300 lines.
- No new dependencies unless the owner approves. Prefer Expo modules that run in Expo Go.

## Design bar

- Follow Apple's Human Interface Guidelines. The app should feel like it belongs on an iPhone.
- System font, SF Symbols on iOS (Ionicons fallback elsewhere), native navigation, sheets and alerts.
- Dark theme first, with tokens in `src/lib/theme.ts`; no hard-coded colors in screens.
- Dynamic Type: text scales; never fix heights on text containers. Test at the largest size.
- VoiceOver: every tappable element has an accessibility role and label; state (checked, selected) is announced.
- Contrast WCAG AA or better. Main actions at least 56 pt, in thumb reach.
- Feel: haptics on set completion and PRs, subtle animations (progress ring), motivating empty states,
  and a loading and error state for every screen.

## Fitness rules

- One-handed use mid-workout: big targets, minimal typing, copy the previous set with one tap.
- Rest timers must survive backgrounding (store the end time, not a countdown).
- kg/lb and km/mi everywhere from day one.
- HealthKit (when added): read steps, heart rate, active energy, sleep, HRV; write workouts. Ask only for
  what's used, with a clear reason for each.
- Apple Watch is in scope: keep workout state in SQLite tables a Watch sync can mirror.

## Before calling a feature done

1. `npm test` and `npm run typecheck` pass.
2. Check it in the web preview at phone size (`npx expo start --web`) and look at a screenshot.
3. Review: HIG fit, no-data / offline / denied-permission states, Dynamic Type and VoiceOver,
   and no leaks (cleared timers and listeners, no heavy work on render).
