import type { AuditState } from "./audit";
import type { InjectionResult, ScriptResult } from "./gates";
import type { MaskedDoc } from "./mask";
import {
  guardBlocked,
  inspectBlocked,
  inspectSuspicious,
  overallLevel,
  worstScore,
} from "./verdict";

const SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script>/gi;

const WITHHELD = (category?: string) =>
  `[WITHHELD — flagged by Inspect${category ? `: ${category}` : ""}]`;

/** The artifact that is allowed to reach an LLM. */
export function buildSafeCopy(masked: string, inspect?: ScriptResult | null): string {
  if (!inspectBlocked(inspect)) return masked;

  let found = false;
  const stripped = masked.replace(SCRIPT_BLOCK, () => {
    found = true;
    return WITHHELD(inspect?.category);
  });

  return found ? stripped : `${masked}\n\n${WITHHELD(inspect?.category)}`;
}

function pct(value?: number): string {
  return value === undefined || Number.isNaN(value) ? "n/a" : `${Math.round(value * 100)}%`;
}

function metaLine(state: AuditState): string {
  const parts = [state.pii, state.injection, state.script]
    .map((g) => g.meta)
    .filter(Boolean);
  if (!parts.length) return "";
  const credits = parts.reduce((sum, m) => sum + (m?.credits ?? 0), 0);
  const latency = parts.reduce((sum, m) => sum + (m?.latencyMs ?? 0), 0);
  return `\`${credits} credits · ${latency.toLocaleString()} ms across ${parts.length} gate(s)\``;
}

export interface ExportInput {
  raw: string;
  masked: MaskedDoc;
  state: AuditState;
  createdAt: Date;
}

export function buildMarkdown({ masked, state, createdAt }: ExportInput): string {
  const guard = state.injection.data;
  const inspect = state.script.data;
  const protect = state.pii.data;
  const inspectSkipped = state.script.status === "skipped";
  const level = overallLevel(guard, inspect);

  const kindLine = Object.entries(masked.counts)
    .map(([label, count]) => `${label} ×${count}`)
    .join(", ");

  const lines: string[] = [
    "# ClientShield audit",
    "",
    `**Verdict:** ${level.toUpperCase()}  `,
    `**Generated:** ${createdAt.toISOString()}  `,
    `**Risk score:** ${pct(worstScore(guard, inspect))}  `,
    ...(metaLine(state) ? [`**Cost:** ${metaLine(state).replace(/^`|`$/g, "")}  `] : []),
    "",
    "## Protect — privacy",
    "",
    `- Entities masked: **${masked.totalEntities}**`,
    `- Distinct tokens: **${masked.tokens.length}**`,
    `- By kind: ${kindLine || "none"}`,
    ...(protect?.threshold !== undefined ? [`- Threshold: ${protect.threshold}`] : []),
    "",
    "## Guard — prompt injection",
    "",
    `- Verdict: **${guard?.verdict ?? "not run"}**`,
    `- Injection probability: **${pct(guard?.injection)}**`,
    `- Category: ${guard?.category ?? "n/a"}`,
    `- Severity: ${guard?.severity ?? "n/a"}`,
    ...(guard && guardBlocked(guard) ? ["- ⚠️ Copy to LLM **blocked** by this gate."] : []),
    ...(guard?.evidence ?? []).map(
      (e) => `- Evidence (${pct(e.confidence)}): \`${e.quote.replace(/\s+/g, " ").slice(0, 240)}\``,
    ),
    "",
    "## Inspect — script safety",
    "",
    `- Verdict: **${
      inspectSkipped ? "skipped (no code-shaped content)" : (inspect?.verdict ?? "not run")
    }**`,
    `- Malicious: **${pct(inspect?.malicious)}** · Suspicious: **${pct(inspect?.suspicious)}**`,
    `- Category: ${inspect?.category ?? "n/a"}`,
    `- Severity: ${inspect?.severity ?? "n/a"}`,
    ...(inspect && inspectBlocked(inspect) ? ["- ⚠️ Code **withheld** from the safe copy."] : []),
    ...(inspect && !inspectBlocked(inspect) && inspectSuspicious(inspect)
      ? ["- Code marked suspicious; review before use."]
      : []),
    "",
    "## Sanitised intake",
    "",
    "```text",
    buildSafeCopy(masked.masked, inspect),
    "```",
    "",
    "---",
    "",
    "_Token map held in browser memory for this session only; it is not part of this export._",
  ];

  return lines.join("\n");
}

export function buildAuditJson({ masked, state, createdAt }: ExportInput) {
  const guard = state.injection.data;
  const inspect = state.script.data;

  return {
    tool: "ClientShield",
    generatedAt: createdAt.toISOString(),
    verdict: overallLevel(guard, inspect),
    riskScore: worstScore(guard, inspect),
    copyBlocked: Boolean(copyBlockFor(state)),
    protect: {
      entitiesMasked: masked.totalEntities,
      distinctTokens: masked.tokens.length,
      countsByKind: masked.counts,
      tokens: masked.tokens.map((t) => ({
        token: t.token,
        kind: t.type,
        confidence: t.confidence,
        start: t.start,
        end: t.end,
      })),
      gate: state.pii.status === "ok" ? { meta: state.pii.meta } : { error: state.pii.error },
    },
    guard: {
      result: guard ?? null,
      gate: state.injection.status === "ok" ? { meta: state.injection.meta } : { error: state.injection.error },
    },
    inspect: {
      result: inspect ?? null,
      gate: state.script.status === "ok" ? { meta: state.script.meta } : { error: state.script.error },
    },
    sanitizedText: buildSafeCopy(masked.masked, inspect),
  };
}

function copyBlockFor(state: AuditState): InjectionResult | ScriptResult | null {
  if (guardBlocked(state.injection.data)) return state.injection.data!;
  if (inspectBlocked(state.script.data)) return state.script.data!;
  return null;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
