export type GateName = "pii" | "injection" | "script";

export const GATES: GateName[] = ["pii", "injection", "script"];

/** Human-facing names used across the UI. */
export const GATE_LABEL: Record<GateName, string> = {
  pii: "Protect",
  injection: "Guard",
  script: "Inspect",
};

export const GATE_BLURB: Record<GateName, string> = {
  pii: "Finds and masks personal data",
  injection: "Detects adversarial instructions",
  script: "Audits code before you run it",
};

export const MAX_TEXT: Record<GateName, number> = {
  pii: 60_000,
  injection: 60_000,
  script: 200_000,
};

export interface PiiEntity {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PiiResult {
  model?: string;
  entities: PiiEntity[];
  counts?: Record<string, number>;
  anonymized_text?: string;
  threshold?: number;
  instructions_used?: string;
}

export interface InjectionEvidence {
  quote: string;
  start: number;
  end: number;
  confidence: number;
}

export interface InjectionResult {
  injection: number;
  verdict: string;
  threshold?: number;
  category?: string;
  categories?: Record<string, number>;
  severity?: string;
  severity_expected?: number;
  evidence?: InjectionEvidence[];
  source?: string;
  instructions_used?: string;
}

export interface ScriptEvidence {
  /** Clocked returns the source line text here, not a line number. */
  line?: string | number;
  start: number;
  end: number;
  confidence: number;
}

export interface ScriptResult {
  malicious: number;
  suspicious: number;
  verdict: string;
  threshold?: number;
  category?: string;
  categories?: Record<string, number>;
  severity?: string;
  severity_expected?: number;
  evidence?: ScriptEvidence[];
  instructions_used?: string;
}

export interface GateMeta {
  endpoint: string;
  latencyMs: number;
  credits?: number;
  costUsd?: number;
  /** True when Clocked rejected a custom entity kind and we retried with the documented catalog. */
  fellBackToDefaultEntities?: boolean;
}

export interface GateOk<T> {
  ok: true;
  gate: GateName;
  data: T;
  meta: GateMeta;
}

export interface GateErr {
  ok: false;
  gate: GateName;
  error: {
    status: number;
    message: string;
    hint?: string;
  };
}

export type GateResponse<T> = GateOk<T> | GateErr;

export type ResultFor = {
  pii: PiiResult;
  injection: InjectionResult;
  script: ScriptResult;
};
