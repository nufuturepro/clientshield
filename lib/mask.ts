import type { PiiEntity } from "./gates";

/**
 * Reversible masking.
 *
 * Clocked's Protect returns `<TYPE>` placeholders — stable per type, but not
 * reversible per instance and not numbered. We rebuild tokenisation on the
 * client from `entities[]` so that the map lives only in browser memory and can
 * be toggled back to the original without another API call.
 */

const LABELS: Record<string, string> = {
  person: "CLIENT_NAME",
  email: "EMAIL",
  phone: "PHONE",
  address: "ADDRESS",
  date_of_birth: "DOB",
  ssn: "SSN",
  credit_card: "CARD",
  bank_account: "BANK",
  ip_address: "IP",
  organization: "ORG",
  domain: "DOMAIN",
  location: "LOCATION",
  username: "USERNAME",
  passport: "PASSPORT",
  drivers_license: "LICENSE",
  medical: "MEDICAL",
};

export interface TokenEntry {
  token: string;
  original: string;
  type: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Segment {
  text: string;
  token?: TokenEntry;
}

export interface MaskedDoc {
  segments: Segment[];
  masked: string;
  tokens: TokenEntry[];
  /** token -> original value. Stays in browser memory; never exported. */
  map: Record<string, string>;
  counts: Record<string, number>;
  totalEntities: number;
  droppedOverlaps: number;
}

export function labelFor(type: string): string {
  return LABELS[type] ?? type.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

/** Highest-confidence, non-overlapping spans, in document order. */
function normalize(entities: PiiEntity[], textLength: number): PiiEntity[] {
  const valid = entities
    .filter(
      (e) =>
        Number.isInteger(e?.start) &&
        Number.isInteger(e?.end) &&
        e.start >= 0 &&
        e.end > e.start &&
        e.end <= textLength,
    )
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const kept: PiiEntity[] = [];
  let cursor = 0;
  for (const entity of valid) {
    if (entity.start < cursor) continue;
    kept.push(entity);
    cursor = entity.end;
  }
  return kept;
}

export function buildMaskedDoc(text: string, entities: PiiEntity[]): MaskedDoc {
  const kept = normalize(entities ?? [], text.length);

  const counters: Record<string, number> = {};
  const byValue = new Map<string, TokenEntry>();
  const tokens: TokenEntry[] = [];
  const segments: Segment[] = [];

  let cursor = 0;
  for (const entity of kept) {
    if (entity.start > cursor) {
      segments.push({ text: text.slice(cursor, entity.start) });
    }

    const valueKey = `${entity.type}\u0000${entity.value}`;
    let token = byValue.get(valueKey);

    if (!token) {
      const label = labelFor(entity.type);
      const next = (counters[label] ?? 0) + 1;
      counters[label] = next;
      token = {
        token: `[${label}_${next}]`,
        original: entity.value,
        type: entity.type,
        label,
        start: entity.start,
        end: entity.end,
        confidence: entity.confidence ?? 0,
      };
      byValue.set(valueKey, token);
      tokens.push(token);
    }

    segments.push({ text: token.token, token });
    cursor = entity.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  const masked = segments.map((s) => s.text).join("");
  const map: Record<string, string> = {};
  for (const token of tokens) map[token.token] = token.original;

  const counts: Record<string, number> = {};
  for (const token of tokens) {
    counts[token.label] = (counts[token.label] ?? 0) + 1;
  }

  return {
    segments,
    masked,
    tokens,
    map,
    counts,
    totalEntities: kept.length,
    droppedOverlaps: (entities?.length ?? 0) - kept.length,
  };
}
