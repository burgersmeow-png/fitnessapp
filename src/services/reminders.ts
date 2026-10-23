import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { dayKey, goalLine, reminderTimes, weekProgress } from '../lib/habits';
import { startOfWeek } from '../lib/social';
import type { Settings } from '../lib/types';
import { loadSessionDates } from './habits';

const PREFIX = 'training-reminder-';

export const remindersSupported = Platform.OS !== 'web';

/** Asks for notification permission. Call it when the user turns reminders on. */
export async function allowReminders(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Replaces the scheduled training reminders with the next two weeks' worth. Run it on app
 * focus and after each session, so a day you already trained, or a week whose goal is hit,
 * gets no nudge. Local notifications, so this works in Expo Go and with no server.
 */
export async function syncReminders(db: SQLiteDatabase, settings: Settings): Promise<void> {
  if (!remindersSupported) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    if (settings.reminderDays.length === 0 || !(await Notifications.getPermissionsAsync()).granted) return;

    const dates = await loadSessionDates(db);
    const now = new Date();
    const progress = weekProgress(dates, settings.weeklyGoal, now);
    const today = dayKey(now);
    const times = reminderTimes(settings.reminderDays, settings.reminderMinutes, {
      trainedToday: dates.some((d) => dayKey(new Date(d)) === today),
      goalHit: progress.done >= progress.goal,
    }, now);
    const monday = startOfWeek(now);
    const nextWeek = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime();
    for (const at of times) {
      // Later weeks start from zero; this week's line reflects what's done so far.
      const p = { ...progress, done: at.getTime() < nextWeek ? progress.done : 0, daysLeft: 7 - ((at.getDay() + 6) % 7) };
      const streak = progress.streak > 1 ? ` Keep your ${progress.streak}-week streak going.` : '';
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${dayKey(at)}`,
        content: { title: 'Time to train', body: `${goalLine(p)}${streak}`, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch {
    // Reminders are a nice-to-have; nothing else depends on them.
  }
}
