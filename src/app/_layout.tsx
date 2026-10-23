import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ErrorState } from '../components/ui';
import { DATABASE_NAME, migrate } from '../lib/db';
import { colors } from '../lib/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

/** Catches anything a screen throws (including a failed database load) and offers a retry. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <>
      <StatusBar style="light" />
      <ErrorState
        message={`Your workouts are safe on this phone. ${error.message ? `(${error.message})` : ''}`.trim()}
        onRetry={retry}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerLargeTitle: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout" options={{ title: 'Workout', presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="cardio" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
