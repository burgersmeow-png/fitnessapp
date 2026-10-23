import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SERVER_URL } from './server';
import { socialConfigured, supabase } from './supabase';

// Expo's push service needs the app's free EAS project id (from `npx eas-cli init`).
const PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** This phone can receive coach alerts. */
export const pushSupported = Platform.OS !== 'web' && socialConfigured && !!SERVER_URL && !!PROJECT_ID;

let registered: string | null = null;

/**
 * Registers this phone for coach alerts. With `ask`, shows the permission prompt if it hasn't
 * been answered; without it, only refreshes a token the user already allowed.
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<void> {
  if (!pushSupported) return;
  try {
    let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && ask && canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    if (token === registered) return;
    const { error } = await supabase.rpc('claim_push_token', { t: token });
    if (!error) registered = token;
  } catch {
    // Offline or not allowed; alerts are a nice-to-have, so try again next time.
  }
}

/** Stops alerts to this phone, e.g. when signing out. */
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  const token = registered;
  registered = null;
  await supabase.from('push_tokens').delete().eq('token', token);
}

/**
 * Tells the other person about something you just did. The server checks it really happened
 * before alerting anyone. Fire and forget: the action itself already succeeded.
 */
export async function notifyOther(type: 'message' | 'assignment' | 'done', id: number): Promise<void> {
  if (!SERVER_URL || !socialConfigured) return;
  try {
    const { data } = await supabase.auth.getSession();
    await fetch(`${SERVER_URL}/push/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ type, id }),
    });
  } catch {
    // No alert this time; the message or workout is still there.
  }
}
