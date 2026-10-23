import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';


let scheduledId: string | null = null;
let permission: boolean | null = null;

async function canNotify(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (permission != null) return permission;
  try {
    const current = await Notifications.getPermissionsAsync();
    permission = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    permission = false;
  }
  return permission;
}

/**
 * Schedules a "rest is over" notification so the lifter hears about it even
 * with the phone locked or the app in the background. Replaces any earlier one.
 */
export async function scheduleRestAlert(seconds: number, nextUp: string): Promise<void> {
  await cancelRestAlert();
  if (seconds < 5 || !(await canNotify())) return;
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest is over', body: `Time for your next set: ${nextUp}`, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds) },
    });
  } catch {
    // Notifications are a nice-to-have; the in-app timer still works.
    scheduledId = null;
  }
}

export async function cancelRestAlert(): Promise<void> {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or never scheduled.
  }
}
