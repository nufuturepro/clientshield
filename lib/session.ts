/**
 * Contest pass: opening the prototype's secret path issues a signed cookie.
 *
 * There is no login page and no password to type. The gate is the URL itself:
 * only `/p/<PROTOTYPE_SLUG>` issues a pass, and the Clocked proxy refuses calls
 * without one. So a judge opens one link and starts working, while a random
 * `POST /api/clocked/pii` against the deployed Worker cannot spend credits.
 *
 * Everything here runs server-side only (route handlers and middleware), so the
 * signing key never reaches the browser and the cookie can't be forged without
 * it. Web Crypto is used so the same code works in Node and in Workers.
 */

export const PASS_COOKIE = "cs_demo_pass";
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Signed with the Clocked key, which is already server-only and always present.
 * The slug is a fallback so a half-configured local run still works; either way
 * the value never leaves the Worker.
 */
function signingKey(): string | null {
  const value = process.env.CLOCKED_API_KEY || process.env.PROTOTYPE_SLUG;
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

/** No key configured at all: leave the proxy open rather than bricking local dev. */
export function passGateEnabled(): boolean {
  return signingKey() !== null;
}

export async function issuePass(): Promise<{
  name: string;
  value: string;
  maxAge: number;
}> {
  const key = signingKey();
  if (!key) throw new Error("No signing key: set CLOCKED_API_KEY or PROTOTYPE_SLUG.");
  const exp = Date.now() + TTL_MS;
  const value = `${exp}.${await hmac(String(exp), key)}`;
  return { name: PASS_COOKIE, value, maxAge: Math.floor(TTL_MS / 1000) };
}

export async function verifyPass(value: string | undefined): Promise<boolean> {
  const key = signingKey();
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

/** Cookie options shared by the middleware and any future issuer. */
export function passCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
