// Dark, high-contrast theme for use in the gym: one accent color for actions,
// green for done and PRs, amber for fatigue. See the plan's visual design section.
export const colors = {
  background: '#0E0F12',
  surface: '#17191E',
  surfaceRaised: '#20232A',
  border: '#2C3038',
  text: '#F4F5F7',
  textMuted: '#9AA0AB',
  accent: '#FF5A1F',
  accentText: '#FFFFFF',
  success: '#2FD07A',
  warning: '#F5B53D',
  danger: '#FF4D4F',
  /** Strava's brand orange, only for Strava buttons and badges. */
  strava: '#FC4C02',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 20 };

export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, color: colors.text },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.4 },
  number: { fontSize: 28, fontWeight: '800' as const, color: colors.text, fontVariant: ['tabular-nums' as const] },
};

/** Minimum size for the main tap targets, bigger than the 44 pt iOS minimum. */
export const TAP = 56;
