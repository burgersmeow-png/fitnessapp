import type { IncomingMessage, ServerResponse } from 'node:http';

export function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

export function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location });
  res.end();
}

export class BodyTooLarge extends Error {}

/** Reads a body as text, refusing anything over `maxBytes`. */
export async function readText(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new BodyTooLarge();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Reads and parses a JSON body, refusing anything over `maxBytes`. */
export async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readText(req, maxBytes));
}

/** This server's own address as the phone sees it, e.g. http://192.168.1.20:8787. */
export function baseUrl(req: IncomingMessage): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http';
  return `${proto}://${req.headers.host}`;
}
