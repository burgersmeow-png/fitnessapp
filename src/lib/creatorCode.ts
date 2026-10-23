// Creator codes from influencers: tidy what people type and read codes out of share links. Pure.

/** "alex 10" → "ALEX10". Returns null when it can't be a code. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length >= 3 && code.length <= 20 ? code : null;
}

/** The code in a creator's link, like https://liftlab.app/?code=ALEX10 or liftlab://welcome?code=alex10. */
export function codeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /[?&](?:code|ref)=([^&#]+)/i.exec(url);
  return m ? normalizeCode(decodeURIComponent(m[1])) : null;
}

/** A random id for this install, so referrals can be counted without an account. */
export function newInstallId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

export interface CreatorState {
  code: string;
  creatorName: string;
  welcome: string | null;
  /** The server has recorded this install for the creator. */
  claimed: boolean;
  /** The server knows this install finished a workout. */
  activeSent: boolean;
}

/** Adds a creator's code to a link they share, so sign-ups from it count for them. */
export function withCode(url: string, code: string | null): string {
  if (!code || /[?&]code=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}code=${code}`;
}
