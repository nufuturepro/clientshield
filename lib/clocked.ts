import "server-only";

import type { GateMeta, GateName } from "./gates";

/**
 * Clocked (rezolve.ai) transport.
 *
 * Server-only: the account key must never reach the browser. `server-only` turns
 * any accidental client import into a build error instead of a silent key leak.
 */

const BASE = "https://clocked.rezolve.ai/clocked";

const PATH: Record<GateName, string> = {
  pii: "/pii",
  injection: "/injection",
  script: "/script",
};

/**
 * Documented catalog kinds. `domain` is a custom kind (needs a description), and
 * is requested because confidential client hostnames are exactly the kind of
 * thing that leaks into a prompt. If Clocked rejects it we fall back to the
 * documented set rather than failing the whole audit.
 */
const DEFAULT_ENTITIES = {
  person: null,
  email: null,
  phone: null,
  address: null,
  date_of_birth: null,
  ssn: null,
  credit_card: null,
  bank_account: null,
  ip_address: null,
  organization: null,
} as const;

const CUSTOM_ENTITIES = {
  ...DEFAULT_ENTITIES,
  domain: {
    description:
      "Custom or internal domain names and hostnames belonging to the client or their vendors, including subdomains of client-owned sites.",
  },
};

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [600, 1200, 2400];

export class ClockedError extends Error {
  status: number;
  hint?: string;

  constructor(status: number, message: string, hint?: string) {
    super(message);
    this.name = "ClockedError";
    this.status = status;
    this.hint = hint;
  }
}

export function isGate(value: string): value is GateName {
  return value === "pii" || value === "injection" || value === "script";
}

interface RawResult {
  data: unknown;
  meta: GateMeta;
}

function apiKey(): string {
  const key = process.env.CLOCKED_API_KEY?.trim();
  if (!key) {
    throw new ClockedError(
      500,
      "CLOCKED_API_KEY is not configured.",
      "Add your Clocked key to .env.local and restart the dev server.",
    );
  }
  return key;
}

function hintFor(status: number): string | undefined {
  switch (status) {
    case 401:
    case 403:
      return "Clocked rejected the credentials. Check CLOCKED_API_KEY in .env.local.";
    case 402:
      return "The Clocked account is out of credits.";
    case 409:
      return "Idempotency conflict — re-run the audit to start a new request.";
    case 413:
      return "Payload too large for the Clocked gateway.";
    case 422:
      return "Clocked could not use part of the request payload.";
    case 429:
      return "Clocked concurrency limit reached (Trial plans allow one request at a time).";
    default:
      return status >= 500 ? "Clocked is unavailable right now." : undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMeta(res: Response, endpoint: string, startedAt: number): GateMeta {
  const credits = Number(res.headers.get("x-clocked-credits"));
  const cost = Number(res.headers.get("x-clocked-cost-usd"));
  return {
    endpoint,
    latencyMs: Date.now() - startedAt,
    credits: Number.isFinite(credits) ? credits : undefined,
    costUsd: Number.isFinite(cost) ? cost : undefined,
  };
}

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : null;
}

/**
 * One logical call: a fresh Idempotency-Key per attempt group, reused verbatim
 * across retries so Clocked can replay instead of double-charging.
 */
async function callOnce(
  gate: GateName,
  payload: Record<string, unknown>,
  attempt: number,
): Promise<RawResult> {
  const endpoint = BASE + PATH[gate];
  const idempotencyKey = crypto.randomUUID();
  const startedAt = Date.now();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Clocked returned ${res.status}.`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed?.error) message = parsed.error;
    } catch {
      if (text) message = text.slice(0, 300);
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      const wait = retryAfterMs(res) ?? BACKOFF_MS[attempt - 1] ?? 2400;
      await sleep(wait);
      return callOnce(gate, payload, attempt + 1);
    }

    throw new ClockedError(res.status, message, hintFor(res.status));
  }

  const data: unknown = await res.json();
  return { data, meta: readMeta(res, PATH[gate], startedAt) };
}

function buildPayload(
  gate: GateName,
  text: string,
  customEntities: boolean,
): Record<string, unknown> {
  switch (gate) {
    case "pii":
      return {
        text,
        entities: customEntities ? CUSTOM_ENTITIES : DEFAULT_ENTITIES,
        threshold: 0.5,
      };
    case "injection":
      // Client intake is *content*, not a user turn — that is the indirect
      // injection path, and the one an intake brief actually travels.
      return { text, source: "content", evidence: true };
    case "script":
      return { script: text, evidence: true };
  }
}

export async function runGate(gate: GateName, text: string): Promise<RawResult> {
  try {
    return await callOnce(gate, buildPayload(gate, text, gate === "pii"), 1);
  } catch (err) {
    // A 422 on Protect usually means a custom entity kind was rejected.
    // Retry once with the documented catalog and a new idempotency key
    // (Clocked signals this with retryAsNew on the error body).
    if (gate === "pii" && err instanceof ClockedError && err.status === 422) {
      const result = await callOnce(gate, buildPayload(gate, text, false), 1);
      result.meta.fellBackToDefaultEntities = true;
      return result;
    }
    throw err;
  }
}
