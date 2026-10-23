import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// While the app is open, rest alerts and reminders stay quiet (the in-app timer and Today cover
// them), but a message or workout from your coach still shows as a banner.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const fromCoach = n.request.content.data?.kind === 'coach';
      return { shouldShowBanner: fromCoach, shouldShowList: fromCoach, shouldPlaySound: fromCoach, shouldSetBadge: false };
    },
  });
}

/** Opens the screen a tapped coach alert points to, including when the tap launched the app. */
export function useNotificationTaps() {
  const response = Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = response.notification.request.content.data as { path?: unknown; params?: Record<string, string> } | undefined;
    if (typeof data?.path === 'string' && data.path.startsWith('/')) {
      router.push({ pathname: data.path, params: data.params } as Href);
    }
    Notifications.clearLastNotificationResponse();
  }, [response]);
}
