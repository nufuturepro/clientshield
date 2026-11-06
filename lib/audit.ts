import type {
  GateErr,
  GateMeta,
  GateName,
  GateResponse,
  InjectionResult,
  PiiResult,
  ScriptResult,
} from "./gates";

export type GateStatus = "idle" | "running" | "ok" | "error" | "skipped";

export interface GateState<T> {
  status: GateStatus;
  data?: T;
  meta?: GateMeta;
  error?: GateErr["error"];
  /** Set when the gate was intentionally not run. */
  note?: string;
}

export interface AuditState {
  pii: GateState<PiiResult>;
  injection: GateState<InjectionResult>;
  script: GateState<ScriptResult>;
}

export const IDLE_AUDIT: AuditState = {
  pii: { status: "idle" },
  injection: { status: "idle" },
  script: { status: "idle" },
};

export async function callGate<T>(gate: GateName, text: string): Promise<GateResponse<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/clocked/${gate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    return {
      ok: false,
      gate,
      error: {
        status: 0,
        message: "Could not reach the local proxy.",
        hint: "Is the dev server still running?",
      },
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return {
      ok: false,
      gate,
      error: { status: res.status, message: `Proxy returned a non-JSON response (${res.status}).` },
    };
  }

  return payload as GateResponse<T>;
}

/** Total credits and wall-clock time across the gates that actually ran. */
export function auditTotals(state: AuditState): { credits: number; latencyMs: number } {
  let credits = 0;
  let latencyMs = 0;
  for (const gate of [state.pii, state.injection, state.script]) {
    credits += gate.meta?.credits ?? 0;
    latencyMs += gate.meta?.latencyMs ?? 0;
  }
  return { credits, latencyMs };
}
