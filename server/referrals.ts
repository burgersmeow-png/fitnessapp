// Creator codes: check a code a follower typed, record their install for the creator, and mark
// it active after their first workout. No sign-in needed, since most people never make an account.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJson, send } from './http';
import { canAlert, chunks, crewMemberId, parseCrewHide, crewBoard, crewWeek, parseCrewJoin, parseCrewSync, type CrewRow, dailyCounts, dailyOpens, newPins, parseClaim, parsePinsRequest, parsePushRequest, parseUseRequest, pinAlert, pinHash, pinsWithUses, parseStatsRequest, rateLimiter, tokensMatch, validCode, validInstall } from './referralRules';
import { admin, databaseConfigured } from './supabase';
import type { Pin } from './referralRules';

export const referralsConfigured = databaseConfigured;

const allow = rateLimiter(20, 60_000);
// One counted open per visitor per code every 30 minutes, so refreshing doesn't inflate it.
const freshOpen = rateLimiter(1, 30 * 60_000);
const ipOf = (req: IncomingMessage) => (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? '?';

async function lookup(code: string) {
  const { data } = await admin().from('creator_codes').select('code, creator_name, welcome, pins').eq('code', code).eq('active', true).maybeSingle();
  return data as { code: string; creator_name: string; welcome: string | null; pins: Pin[] } | null;
}

const EXPO_PUSH = process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send';

/** Tells followers who opted in about new pins. Forgets phones that no longer exist. */
async function alertFollowers(code: string, creatorName: string, pins: Pin[]): Promise<number> {
  const { data } = await admin().from('referrals').select('push_token').eq('code', code).not('push_token', 'is', null);
  const tokens = [...new Set((data ?? []).map((r: { push_token: string }) => r.push_token))];
  const alert = pinAlert(creatorName, pins);
  let sent = 0;
  for (const batch of chunks(tokens)) {
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch.map((to) => ({ to, sound: 'default', ...alert }))),
    });
    if (!res.ok) continue;
    const { data: results } = (await res.json()) as { data?: { details?: { error?: string } }[] };
    const gone = batch.filter((_, i) => results?.[i]?.details?.error === 'DeviceNotRegistered');
    if (gone.length) await admin().from('referrals').update({ push_token: null }).in('push_token', gone);
    sent += batch.length - gone.length;
  }
  return sent;
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
      // Social proof for the landing page and the app: how many of the crew trained this week.
      const { count } = await admin()
        .from('creator_crew')
        .select('install_id', { count: 'exact', head: true })
        .eq('code', found.code)
        .eq('week', crewWeek(new Date()))
        .eq('hidden', false)
        .gt('days', 0);
      return send(res, 200, { code: found.code, creatorName: found.creator_name, welcome: found.welcome, pins: found.pins ?? [], crewThisWeek: count ?? 0 }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/open') {
      // The landing page was opened with this code. Sent with sendBeacon, so the body is plain text.
      const { code } = ((await readJson(req, 128)) ?? {}) as { code?: unknown };
      if (typeof code !== 'string' || !validCode(code)) return send(res, 400, { error: 'Bad request' }), true;
      if (freshOpen(`${ipOf(req)}|${code}`) && (await lookup(code))) {
        const { error } = await admin().rpc('count_link_open', { p_code: code });
        if (error) throw error;
      }
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/push') {
      // A follower opted in to hear when their creator posts. Their install must already be credited.
      const ask = parsePushRequest(await readJson(req, 512));
      if (!ask) return send(res, 400, { error: 'Bad request' }), true;
      const { error } = await admin().from('referrals').update({ push_token: ask.token }).eq('install_id', ask.installId);
      if (error) throw error;
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/used') {
      // A credited follower started one of their creator's pins. Anything not pinned is ignored.
      const ask = parseUseRequest(await readJson(req, 6000));
      if (!ask) return send(res, 400, { error: 'Bad request' }), true;
      const { data: ref } = await admin().from('referrals').select('code').eq('install_id', ask.installId).maybeSingle();
      const found = ref ? await lookup(ref.code) : null;
      if (found && (found.pins ?? []).some((p) => p.payload === ask.payload)) {
        const { error } = await admin()
          .from('creator_pin_uses')
          .upsert({ code: found.code, pin_hash: pinHash(ask.payload), install_id: ask.installId }, { onConflict: 'code,pin_hash,install_id', ignoreDuplicates: true });
        if (error) throw error;
      }
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/ref/crew/')) {
      // A creator's weekly leaderboard. POST throughout so install ids stay out of URLs and logs.
      const body = await readJson(req, 512);
      const installId = (body as { installId?: unknown } | null)?.installId;
      if (!validInstall(installId)) return send(res, 400, { error: 'Bad request' }), true;
      const { data: ref } = await admin().from('referrals').select('code').eq('install_id', installId).maybeSingle();
      const creator = ref ? await lookup(ref.code) : null;
      if (!creator) return send(res, 404, { error: 'Add a creator code first.' }), true;
      const week = crewWeek(new Date());
      const action = url.pathname.slice('/ref/crew/'.length);
      if (action === 'join') {
        const ask = parseCrewJoin(body);
        if (!ask) return send(res, 400, { error: 'Pick a name of 2 to 20 letters or numbers.' }), true;
        const { data: was } = await admin().from('creator_crew').select('week, days').eq('install_id', installId).maybeSingle();
        const { error } = await admin()
          .from('creator_crew')
          .upsert({ install_id: installId, code: creator.code, nickname: ask.nickname, week, days: was?.week === week ? was.days : 0, updated_at: new Date().toISOString() });
        if (error) throw error;
      } else if (action === 'sync') {
        const ask = parseCrewSync(body);
        if (!ask) return send(res, 400, { error: 'Bad request' }), true;
        const { error } = await admin().from('creator_crew').update({ week, days: ask.days, updated_at: new Date().toISOString() }).eq('install_id', installId);
        if (error) throw error;
      } else if (action === 'leave') {
        const { error } = await admin().from('creator_crew').delete().eq('install_id', installId);
        if (error) throw error;
        return send(res, 200, { ok: true }), true;
      } else if (action !== 'board') {
        return send(res, 404, { error: 'Not found' }), true;
      }
      const { data: rows } = await admin()
        .from('creator_crew')
        .select('install_id, nickname, days, updated_at')
        .eq('code', creator.code)
        .eq('week', week)
        .eq('hidden', false);
      const board = crewBoard((rows ?? []) as CrewRow[], installId);
      return send(res, 200, { creatorName: creator.creator_name, week, ...board }), true;
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
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const [{ data: stats }, { data: recent }, { data: opens }, { data: uses }, { data: crew }] = await Promise.all([
        admin().from('creator_stats').select('signups, active_users, signups_last_7_days').eq('code', ask.code).single(),
        admin()
          .from('referrals')
          .select('created_at')
          .eq('code', ask.code)
          .gte('created_at', since),
        admin().from('creator_link_opens').select('day, opens').eq('code', ask.code).gte('day', since.slice(0, 10)),
        admin().from('creator_pin_uses').select('pin_hash').eq('code', ask.code),
        // This week's crew, plus anyone hidden (so they can be shown again).
        admin()
          .from('creator_crew')
          .select('install_id, nickname, days, hidden')
          .eq('code', ask.code)
          .or(`week.eq.${crewWeek(new Date())},hidden.eq.true`)
          .order('days', { ascending: false })
          .limit(100),
      ]);
      return send(res, 200, {
        code: c.code,
        creatorName: c.creator_name,
        signups: stats?.signups ?? 0,
        activeUsers: stats?.active_users ?? 0,
        signupsLast7Days: stats?.signups_last_7_days ?? 0,
        crew: ((crew ?? []) as { install_id: string; nickname: string; days: number; hidden: boolean }[]).map((m) => ({
          id: crewMemberId(m.install_id),
          nickname: m.nickname,
          days: m.days,
          hidden: m.hidden,
        })),
        pins: pinsWithUses((c.pins ?? []) as Pin[], (uses ?? []) as { pin_hash: string }[]),
        dailyOpens: dailyOpens((opens ?? []) as { day: string; opens: number }[], new Date()),
        daily: dailyCounts((recent ?? []).map((r: { created_at: string }) => r.created_at), new Date()),
      }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/crew-hide') {
      // The creator moderating their crew leaderboard.
      const ask = parseCrewHide(await readJson(req, 256));
      if (!ask) return send(res, 400, { error: 'Bad request' }), true;
      const { data: c } = await admin().from('creator_codes').select('stats_token').eq('code', ask.code).maybeSingle();
      if (!c || !tokensMatch(c.stats_token, ask.token)) return send(res, 403, { error: 'That dashboard link isn’t valid. Ask for a new one.' }), true;
      const { data: members } = await admin().from('creator_crew').select('install_id').eq('code', ask.code);
      const member = (members ?? []).find((m: { install_id: string }) => crewMemberId(m.install_id) === ask.id);
      if (!member) return send(res, 404, { error: 'That person isn’t in your crew any more.' }), true;
      const { error } = await admin().from('creator_crew').update({ hidden: ask.hidden }).eq('install_id', member.install_id);
      if (error) throw error;
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === 'POST' && url.pathname === '/ref/pins') {
      // The creator's public page: what shows when followers open their link.
      const ask = parsePinsRequest(await readJson(req, 64_000));
      if (!ask) return send(res, 400, { error: 'Pin up to 6 workout, plan or challenge links.' }), true;
      const { data: c } = await admin().from('creator_codes').select('stats_token, creator_name, pins, last_alert_at').eq('code', ask.code).maybeSingle();
      if (!c || !tokensMatch(c.stats_token, ask.token)) return send(res, 403, { error: 'That dashboard link isn’t valid. Ask for a new one.' }), true;
      if (ask.bad.length) return send(res, 400, { error: `Line ${ask.bad.map((i) => i + 1).join(', ')} isn’t a LiftLab workout, plan or challenge link.` }), true;
      const fresh = newPins((c.pins ?? []) as Pin[], ask.pins);
      const now = new Date();
      const alerting = fresh.length > 0 && canAlert(c.last_alert_at, now);
      const { error } = await admin()
        .from('creator_codes')
        .update({ pins: ask.pins, ...(alerting ? { last_alert_at: now.toISOString() } : {}) })
        .eq('code', ask.code);
      if (error) throw error;
      const notified = alerting ? await alertFollowers(ask.code, c.creator_name, fresh).catch((e) => (console.error('creator alert', e), 0)) : 0;
      return send(res, 200, { pins: ask.pins, notified, alertedRecently: fresh.length > 0 && !alerting }), true;
    }
    return send(res, 404, { error: 'Not found' }), true;
  } catch (e) {
    console.error('referrals', e);
    return send(res, 500, { error: 'Something went wrong. Try again.' }), true;
  }
}
