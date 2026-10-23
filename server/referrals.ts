// Creator codes: check a code a follower typed, record their install for the creator, and mark
// it active after their first workout. No sign-in needed, since most people never make an account.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJson, send } from './http';
import { dailyCounts, parseClaim, parsePinsRequest, parseStatsRequest, rateLimiter, tokensMatch, validCode, validInstall } from './referralRules';
import { admin, databaseConfigured } from './supabase';
import type { Pin } from './referralRules';

export const referralsConfigured = databaseConfigured;

const allow = rateLimiter(20, 60_000);
const ipOf = (req: IncomingMessage) => (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? '?';

async function lookup(code: string) {
  const { data } = await admin().from('creator_codes').select('code, creator_name, welcome, pins').eq('code', code).eq('active', true).maybeSingle();
  return data as { code: string; creator_name: string; welcome: string | null; pins: Pin[] } | null;
}

/** Routes /ref/*. Returns false when the path isn't a referral route. */
export async function handleReferrals(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/ref/')) return false;
  if (!referralsConfigured()) return send(res, 503, { error: 'Creator codes aren’t set up on the server yet.' }), true;
  if (!allow(ipOf(req))) return send(res, 429, { error: 'Too many tries. Wait a minute and try again.' }), true;
  try {
    if (req.method === 'GET' && url.pathname === '/ref/check') {
      const code = url.searchParams.get('code');
      const found = validCode(code) ? await lookup(code!) : null;
      if (!found) return send(res, 404, { error: 'That code isn’t valid. Check the spelling with your creator.' }), true;
      return send(res, 200, { code: found.code, creatorName: found.creator_name, welcome: found.welcome, pins: found.pins ?? [] }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/claim') {
      const claim = parseClaim(await readJson(req, 512));
      if (!claim) return send(res, 400, { error: 'Bad request' }), true;
      if (!(await lookup(claim.code))) return send(res, 404, { error: 'That code isn’t valid.' }), true;
      // One install, one creator: the first code entered keeps the credit.
      const { error } = await admin()
        .from('referrals')
        .upsert({ install_id: claim.installId, code: claim.code }, { onConflict: 'install_id', ignoreDuplicates: true });
      if (error) throw error;
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/active') {
      const { installId } = ((await readJson(req, 256)) ?? {}) as { installId?: unknown };
      if (!validInstall(installId)) return send(res, 400, { error: 'Bad request' }), true;
      const { error } = await admin().from('referrals').update({ active_at: new Date().toISOString() }).eq('install_id', installId).is('active_at', null);
      if (error) throw error;
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/stats') {
      // The creator's private dashboard. POST so the secret stays out of URLs and logs.
      const ask = parseStatsRequest(await readJson(req, 256));
      const denied = () => send(res, 403, { error: 'That dashboard link isn’t valid. Ask for a new one.' });
      if (!ask) return denied(), true;
      const { data: c } = await admin().from('creator_codes').select('code, creator_name, stats_token, pins').eq('code', ask.code).maybeSingle();
      if (!c || !tokensMatch(c.stats_token, ask.token)) return denied(), true;
      const [{ data: stats }, { data: recent }] = await Promise.all([
        admin().from('creator_stats').select('signups, active_users, signups_last_7_days').eq('code', ask.code).single(),
        admin()
          .from('referrals')
          .select('created_at')
          .eq('code', ask.code)
          .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString()),
      ]);
      return send(res, 200, {
        code: c.code,
        creatorName: c.creator_name,
        signups: stats?.signups ?? 0,
        activeUsers: stats?.active_users ?? 0,
        signupsLast7Days: stats?.signups_last_7_days ?? 0,
        pins: c.pins ?? [],
        daily: dailyCounts((recent ?? []).map((r: { created_at: string }) => r.created_at), new Date()),
      }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/pins') {
      // The creator's public page: what shows when followers open their link.
      const ask = parsePinsRequest(await readJson(req, 64_000));
      if (!ask) return send(res, 400, { error: 'Pin up to 6 workout, plan or challenge links.' }), true;
      const { data: c } = await admin().from('creator_codes').select('stats_token').eq('code', ask.code).maybeSingle();
      if (!c || !tokensMatch(c.stats_token, ask.token)) return send(res, 403, { error: 'That dashboard link isn’t valid. Ask for a new one.' }), true;
      if (ask.bad.length) return send(res, 400, { error: `Line ${ask.bad.map((i) => i + 1).join(', ')} isn’t a LiftLab workout, plan or challenge link.` }), true;
      const { error } = await admin().from('creator_codes').update({ pins: ask.pins }).eq('code', ask.code);
      if (error) throw error;
      return send(res, 200, { pins: ask.pins }), true;
    }
    return send(res, 404, { error: 'Not found' }), true;
  } catch (e) {
    console.error('referrals', e);
    return send(res, 500, { error: 'Something went wrong. Try again.' }), true;
  }
}
