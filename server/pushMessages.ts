// What each coaching alert says and where tapping it goes. Pure, so it's unit tested.

export interface Alert {
  title: string;
  body: string;
  /** Read by the app: the screen to open, and its params. */
  data: { path: string; params?: Record<string, string> };
}

const clip = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export const messageAlert = (m: { coach: string; client: string; text: string }, senderName: string): Alert => ({
  title: senderName,
  body: clip(m.text.trim()),
  data: { path: '/coaching/chat', params: { coach: m.coach, client: m.client, name: senderName } },
});

/** "Today", "Tomorrow", or "Mon 26 Oct" for when an assigned workout is planned. */
export function planDay(scheduledFor: string, now: Date): string {
  const [y, m, d] = scheduledFor.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 864e5);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const assignmentAlert = (a: { title: string; scheduled_for: string }, coachName: string, now: Date): Alert => ({
  title: `New workout from ${coachName}`,
  body: `${clip(a.title, 80)}, planned for ${planDay(a.scheduled_for, now)}.`,
  data: { path: '/' },
});

export const doneAlert = (a: { client: string; title: string }, clientName: string): Alert => ({
  title: `${clientName} finished a workout`,
  body: `${clip(a.title, 80)} is done. Tap to see how it went.`,
  data: { path: `/coaching/client/${a.client}` },
});
