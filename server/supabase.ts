// Server-side database access with the service_role key, which never ships in the app.
import type { IncomingMessage } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const databaseConfigured = () => !!(SUPABASE_URL && SERVICE_KEY);

export const admin = () => createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

/** The signed-in app user, from the Supabase access token the app sends. */
export async function caller(req: IncomingMessage): Promise<string | null> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user?.id ?? null;
}
