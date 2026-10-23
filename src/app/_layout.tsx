import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ErrorState } from '../components/ui';
import { DATABASE_NAME, migrate } from '../lib/db';
import { colors } from '../lib/theme';
import { useNotificationTaps } from '../services/notifications';

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
  useNotificationTaps();
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerLargeTitle: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="workout" options={{ title: 'Workout', presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="session/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="cardio" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="food-add" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="coach" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="add-friends" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="post/[id]" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="exercises" options={{ title: 'Exercises', headerBackTitle: 'Back' }} />
          <Stack.Screen name="badges" options={{ title: 'Badges', headerBackTitle: 'Back' }} />
          <Stack.Screen name="programs" options={{ title: 'Programs', headerBackTitle: 'Back' }} />
          <Stack.Screen name="progress" options={{ title: 'Progress', headerBackTitle: 'Back' }} />
          <Stack.Screen name="coaching/index" options={{ title: 'Coaching', headerBackTitle: 'Back' }} />
          <Stack.Screen name="coaching/client/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
          <Stack.Screen name="coaching/assign" options={{ title: 'Assign workout', presentation: 'modal' }} />
          <Stack.Screen name="coaching/chat" options={{ title: 'Messages', headerBackTitle: 'Back' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
