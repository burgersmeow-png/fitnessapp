import 'expo-sqlite/localStorage/install';
import { createClient, type Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * The online database for social features (a free Supabase project). The URL and the
 * "anon" key are public by design: what each person can read or change is enforced by
 * the database's row level security (supabase/migrations), not by keeping these secret.
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const socialConfigured = !!(URL && ANON_KEY);

export const supabase = createClient(URL ?? 'http://localhost', ANON_KEY ?? 'not-configured', {
  auth: {
    // Kept on the phone in SQLite, so you stay signed in.
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the sign-in only while the app is open (Supabase's guidance for React Native).
if (Platform.OS !== 'web' && socialConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** The current sign-in: undefined while loading, null when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(socialConfigured ? undefined : null);
  useEffect(() => {
    if (!socialConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
