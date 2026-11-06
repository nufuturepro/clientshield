/**
 * Contest gate: password -> signed session cookie.
 *
 * Everything here runs server-side only (route handlers and middleware), so the
 * password never reaches the browser and the cookie can't be forged without the
 * secret. Web Crypto is used so the same code works in Node and in Workers.
 */

export const SESSION_COOKIE = "cs_demo_session";
const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string | null {
  // One variable is enough: rotating the password also invalidates old sessions.
  const value = process.env.DEMO_SESSION_SECRET || process.env.DEMO_PASSWORD;
  return value && value.length > 0 ? value : null;
}

function enc(input: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(input);
}

async function hmac(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare digests so length and early bytes don't leak through timing. */
async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", enc(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function demoLockEnabled(): boolean {
  return secret() !== null;
}

export async function passwordOk(input: string): Promise<boolean> {
  const expected = process.env.DEMO_PASSWORD;
  const key = secret();
  if (!expected || !key || !input) return false;
  const [given, wanted] = await Promise.all([digest(input), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < wanted.length; i++) diff |= given.charCodeAt(i) ^ wanted.charCodeAt(i);
  return diff === 0;
}

export async function createSession(): Promise<{
  name: string;
  value: string;
  maxAge: number;
}> {
  const key = secret();
  if (!key) throw new Error("DEMO_PASSWORD is not configured.");
  const exp = Date.now() + TTL_MS;
  const value = `${exp}.${await hmac(String(exp), key)}`;
  return { name: SESSION_COOKIE, value, maxAge: Math.floor(TTL_MS / 1000) };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  const key = secret();
  if (!key || !value) return false;

  const dot = value.indexOf(".");
  if (dot <= 0) return false;

  const expRaw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const expected = await hmac(expRaw, key);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
