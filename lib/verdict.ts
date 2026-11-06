import type { InjectionResult, ScriptResult } from "./gates";

export type Level = "safe" | "caution" | "danger";

export const LEVEL_LABEL: Record<Level, string> = {
  safe: "Clear",
  caution: "Caution",
  danger: "Blocked",
};

/** Guard is a detector, not a policy engine — but its verdict is what we gate on. */
export function guardBlocked(result?: InjectionResult | null): boolean {
  if (!result) return false;
  const verdict = (result.verdict ?? "").toLowerCase();
  const threshold = result.threshold ?? 0.5;
  return verdict.includes("inject") || (result.injection ?? 0) >= threshold;
}

/** `suspicious` is a warning; only a malicious verdict withholds the code. */
export function inspectBlocked(result?: ScriptResult | null): boolean {
  if (!result) return false;
  const verdict = (result.verdict ?? "").toLowerCase();
  const threshold = result.threshold ?? 0.5;
  return verdict.includes("malicious") || (result.malicious ?? 0) >= Math.max(threshold, 0.6);
}

export function inspectSuspicious(result?: ScriptResult | null): boolean {
  if (!result) return false;
  const verdict = (result.verdict ?? "").toLowerCase();
  const threshold = result.threshold ?? 0.5;
  if (verdict.includes("suspicious")) return true;
  return (result.suspicious ?? 0) >= threshold;
}

export function worstScore(guard?: InjectionResult | null, inspect?: ScriptResult | null): number {
  return Math.max(guard?.injection ?? 0, inspect?.malicious ?? 0, inspect?.suspicious ?? 0);
}

export function overallLevel(
  guard?: InjectionResult | null,
  inspect?: ScriptResult | null,
): Level {
  if (guardBlocked(guard) || inspectBlocked(inspect)) return "danger";
  if (inspectSuspicious(inspect) || (guard && (guard.injection ?? 0) > 0.25)) return "caution";
  return "safe";
}

function why(guard?: InjectionResult | null, inspect?: ScriptResult | null): string | null {
  if (guardBlocked(guard)) {
    const category = guard?.category ? ` (${guard.category})` : "";
    return `Guard detected a prompt injection${category}.`;
  }
  if (inspectBlocked(inspect)) {
    const category = inspect?.category ? ` (${inspect.category})` : "";
    return `Inspect flagged the code as malicious${category}.`;
  }
  return null;
}

/** The single reason string shown on a disabled Copy button. */
export function copyBlockedReason(
  guard?: InjectionResult | null,
  inspect?: ScriptResult | null,
): string | null {
  return why(guard, inspect);
}

export function severityTone(severity?: string): "neutral" | "warn" | "bad" {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical" || s === "high") return "bad";
  if (s === "medium" || s === "low") return "warn";
  return "neutral";
}
