// Strava sign-in. The client secret stays on the server; the app gets back
// only the athlete's own tokens and calls the Strava API with them directly.
//
// Strava app settings (strava.com/settings/api): set "Authorization Callback
// Domain" to this server's host, e.g. 192.168.1.20 for a PC on home Wi-Fi.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { baseUrl, BodyTooLarge, readJson, redirect, send } from './http';

const OAUTH = (process.env.STRAVA_OAUTH_URL ?? 'https://www.strava.com').replace(/\/$/, '');
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
// Read imports past activities; write posts finished strength workouts.
const SCOPE = 'read,activity:read_all,activity:write';

export const stravaConfigured = () => !!(CLIENT_ID && CLIENT_SECRET);

/**
 * Where the tokens may be sent after sign-in: the app's own scheme, plus Expo Go
 * and the web preview while developing. Anything else could leak a sign-in.
 */
function allowedReturn(url: string): boolean {
  if (url.startsWith('liftlab://')) return true;
  if (process.env.NODE_ENV === 'production') return false;
  return /^exps?:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
}

function withParams(url: string, params: Record<string, string>): string {
  return `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, ...params }),
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

/** Routes /strava/*. Returns false when the path isn't a Strava route. */
export async function handleStrava(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/strava/')) return false;
  if (!stravaConfigured()) {
    send(res, 503, { error: 'Strava isn’t set up on the server. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.' });
    return true;
  }

  // 1. The app opens this in a browser sheet; we send the athlete to Strava.
  if (req.method === 'GET' && url.pathname === '/strava/start') {
    const back = url.searchParams.get('return') ?? '';
    if (!allowedReturn(back)) return send(res, 400, { error: 'Unknown return address' }), true;
    redirect(
      res,
      `${OAUTH}/oauth/authorize?${new URLSearchParams({
        client_id: CLIENT_ID!,
        response_type: 'code',
        redirect_uri: `${baseUrl(req)}/strava/callback`,
        approval_prompt: 'auto',
        scope: SCOPE,
        state: back,
      })}`,
    );
    return true;
  }

  // 2. Strava sends the athlete back here; we swap the code for tokens and return to the app.
  if (req.method === 'GET' && url.pathname === '/strava/callback') {
    const back = url.searchParams.get('state') ?? '';
    if (!allowedReturn(back)) return send(res, 400, { error: 'Unknown return address' }), true;
    const code = url.searchParams.get('code');
    if (!code) return redirect(res, withParams(back, { error: url.searchParams.get('error') ?? 'access_denied' })), true;
    try {
      const t = await tokenRequest({ code, grant_type: 'authorization_code' });
      const athlete = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ');
      redirect(
        res,
        withParams(back, {
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          expires_at: String(t.expires_at),
          athlete: athlete || 'Strava athlete',
          scope: url.searchParams.get('scope') ?? '',
        }),
      );
    } catch (error) {
      console.error(error);
      redirect(res, withParams(back, { error: 'token_exchange_failed' }));
    }
    return true;
  }

  // 3. The app refreshes an expired access token (it lasts six hours).
  if (req.method === 'POST' && url.pathname === '/strava/refresh') {
    try {
      const { refreshToken } = (await readJson(req, 4096)) as { refreshToken?: unknown };
      if (typeof refreshToken !== 'string') return send(res, 400, { error: 'Send refreshToken' }), true;
      const t = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
      send(res, 200, { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
    } catch (error) {
      if (error instanceof BodyTooLarge || error instanceof SyntaxError) return send(res, 400, { error: 'Invalid request' }), true;
      console.error(error);
      send(res, 502, { error: 'Strava refused the refresh. Connect Strava again.' });
    }
    return true;
  }

  send(res, 404, { error: 'Not found' });
  return true;
}
