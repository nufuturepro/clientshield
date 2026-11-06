"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { GateState } from "@/lib/audit";
import type { InjectionResult, ScriptResult } from "@/lib/gates";
import {
  guardBlocked,
  inspectBlocked,
  inspectSuspicious,
  overallLevel,
  severityTone,
  worstScore,
  type Level,
} from "@/lib/verdict";

interface Props {
  guard: GateState<InjectionResult>;
  inspect: GateState<ScriptResult>;
  raw: string;
  /** True for the whole audit, including Protect — the bar sweeps the entire run. */
  auditing: boolean;
  onLocate: (start: number, end: number) => void;
}

const pct = (value?: number) =>
  value === undefined || Number.isNaN(value) ? "—" : `${Math.round(value * 100)}%`;

function Meter({
  value,
  tone,
  driven,
}: {
  value: number;
  tone: "safe" | "warn" | "bad";
  /** JS sets width every frame, so the CSS transition would restart each tick. */
  driven?: boolean;
}) {
  const width = Math.max(2, Math.min(100, Math.round(value * 100)));
  return (
    <div className="meter" role="meter" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
      <i
        data-tone={tone}
        style={{ width: `${width}%`, ...(driven ? { transition: "none" } : null) }}
      />
    </div>
  );
}

const COUNT_UP_MS = 720;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Eases the displayed value toward `target`: 0 -> target on mount, so a score
 * reads as landing rather than appearing fully formed, and from wherever it
 * currently sits when a later gate raises it (Guard 3 -> Inspect 99), never
 * snapping back to zero.
 */
function useTween(target: number, duration = COUNT_UP_MS): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    // A tab that isn't compositing — backgrounded window, screen recording,
    // automated screenshot — never fires requestAnimationFrame. Snapping beats
    // leaving the readout at 0 underneath a "blocked" label: that is a wrong
    // number, not merely a missing animation.
    if (typeof document !== "undefined" && document.hidden) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Same failure mode even when the tab claims to be visible: if frames
    // stall, land on the target rather than reporting a stale value.
    const settle = window.setTimeout(() => {
      fromRef.current = target;
      setValue(target);
    }, duration + 150);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}

/** Number and bar share one animated value, so they never drift apart. */
function GuardMeter({ value, tone }: { value: number; tone: "safe" | "bad" }) {
  const shown = useTween(value);
  return (
    <>
      <Meter value={shown} tone={tone} driven />
      <span className="meter-val">{`${Math.round(shown * 100)}%`}</span>
    </>
  );
}

/**
 * Header risk readout. The ring and the number are the same tweened value, so
 * the dial can never show a score the digits disagree with.
 */
function RiskDial({ score, level }: { score: number; level: Level }) {
  const shown = useTween(score, 520);
  const danger = level === "danger";
  return (
    <div className="risk" data-tone={level}>
      <span
        className="risk-dial"
        aria-hidden="true"
        style={{ "--v": Math.round(shown * 100) } as CSSProperties}
      />
      <span className="risk-num">{Math.round(shown * 100)}</span>
      <span className="risk-label">
        risk
        <b>{danger ? "blocked" : level}</b>
      </span>
    </div>
  );
}

export function SafetyCard({ guard, inspect, raw, auditing, onLocate }: Props) {
  const guardResult = guard.data;
  const inspectResult = inspect.data;
  const level = overallLevel(guardResult, inspectResult);
  const risk = worstScore(guardResult, inspectResult);
  const noneYet = guard.status === "idle" && inspect.status === "idle";
  // No score means nothing to report: a running gate must not read as "risk 0, clear".
  const hasRisk = Boolean(guardResult || inspectResult);
  // During Protect neither gate has started, but the card should still show the
  // queued work being scanned rather than an empty-state placeholder.
  const showBlocks = !noneYet || auditing;

  const scriptSnippet = (start: number, end: number) => {
    const slice = raw.slice(Math.max(0, start), Math.min(raw.length, end));
    return slice.replace(/\s+/g, " ").trim().slice(0, 220);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-glyph safety" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 4.6v4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.2" r="0.85" fill="currentColor" />
          </svg>
        </span>
        <div className="card-title">
          <p className="eyebrow">Guard + Inspect · safety gates</p>
          <h3>Threat assessment</h3>
        </div>
        <div className="spacer" />
        {hasRisk && <RiskDial score={risk} level={level} />}
      </div>

      {noneYet && !auditing && (
        <div className="empty">
          <p>No verdicts yet.</p>
          <span>Guard scores injected instructions; Inspect scores the code before you touch it.</span>
        </div>
      )}

      {showBlocks && (
        <div className="gate-blocks">
          <div className="gate-block" data-tone={guardBlocked(guardResult) ? "bad" : guard.status === "ok" ? "safe" : "neutral"}>
            <div className="gb-head">
              <span className="gb-dot" aria-hidden="true" />
              <h4>Guard</h4>
              <span className="gb-sub">prompt injection</span>
              <div className="spacer" />
              <Verdict status={guard.status} blocked={guardBlocked(guardResult)} label={guardResult?.verdict} />
            </div>

            {guard.status === "ok" && guardResult ? (
              <>
                <div className="meter-row">
                  <GuardMeter
                    value={guardResult.injection ?? 0}
                    tone={guardBlocked(guardResult) ? "bad" : "safe"}
                  />
                </div>
                <div className="gb-meta">
                  <span className="kv">
                    category <b>{guardResult.category ?? "n/a"}</b>
                  </span>
                  <span className="kv" data-tone={severityTone(guardResult.severity)}>
                    severity <b>{guardResult.severity ?? "n/a"}</b>
                  </span>
                  <span className="kv">
                    source <b>{guardResult.source ?? "content"}</b>
                  </span>
                </div>
                {guardResult.evidence && guardResult.evidence.length > 0 && (
                  <ul className="evidence">
                    {guardResult.evidence.slice(0, 3).map((item, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => onLocate(item.start, item.end)}
                          title="Jump to this span in the raw input"
                        >
                          <span className="quote">“{item.quote.replace(/\s+/g, " ").slice(0, 240)}”</span>
                          <span className="conf">{pct(item.confidence)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : guard.status === "running" ? (
              <div className="skeleton-body short" aria-hidden="true">
                <div className="skel" style={{ width: "62%" }} />
                <div className="skel" style={{ width: "40%" }} />
              </div>
            ) : guard.status === "idle" ? (
              <p className="notice">Queued — scores the text as soon as Protect returns.</p>
            ) : (
              <div className="node-error">
                <span>{guard.error?.message}</span>
                {guard.error?.hint && <em>{guard.error.hint}</em>}
              </div>
            )}
          </div>

          <div
            className="gate-block"
            data-tone={
              inspectBlocked(inspectResult)
                ? "bad"
                : inspectSuspicious(inspectResult)
                  ? "warn"
                  : inspect.status === "ok"
                    ? "safe"
                    : "neutral"
            }
          >
            <div className="gb-head">
              <span className="gb-dot" aria-hidden="true" />
              <h4>Inspect</h4>
              <span className="gb-sub">script safety</span>
              <div className="spacer" />
              <Verdict
                status={inspect.status}
                blocked={inspectBlocked(inspectResult)}
                label={inspectResult?.verdict}
                warn={inspectSuspicious(inspectResult) && !inspectBlocked(inspectResult)}
              />
            </div>

            {inspect.status === "ok" && inspectResult ? (
              <>
                <div className="meter-row">
                  <span className="meter-tag">malicious</span>
                  <Meter value={inspectResult.malicious ?? 0} tone={inspectBlocked(inspectResult) ? "bad" : "safe"} />
                  <span className="meter-val">{pct(inspectResult.malicious)}</span>
                </div>
                <div className="meter-row">
                  <span className="meter-tag">suspicious</span>
                  <Meter
                    value={inspectResult.suspicious ?? 0}
                    tone={inspectSuspicious(inspectResult) ? "warn" : "safe"}
                  />
                  <span className="meter-val">{pct(inspectResult.suspicious)}</span>
                </div>
                <div className="gb-meta">
                  <span className="kv">
                    category <b>{inspectResult.category ?? "n/a"}</b>
                  </span>
                  <span className="kv" data-tone={severityTone(inspectResult.severity)}>
                    severity <b>{inspectResult.severity ?? "n/a"}</b>
                  </span>
                </div>
                {inspectResult.evidence && inspectResult.evidence.length > 0 && (
                  <ul className="evidence">
                    {inspectResult.evidence.slice(0, 3).map((item, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => onLocate(item.start, item.end)}
                          title="Jump to this span in the raw input"
                        >
                          <span className="quote">
                            <code>{scriptSnippet(item.start, item.end) || "(empty span)"}</code>
                          </span>
                          <span className="conf">{pct(item.confidence)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : inspect.status === "skipped" ? (
              <p className="notice">
                {inspect.note ?? "No code-shaped content — Inspect skipped."}
              </p>
            ) : inspect.status === "running" ? (
              <div className="skeleton-body short" aria-hidden="true">
                <div className="skel" style={{ width: "58%" }} />
                <div className="skel" style={{ width: "44%" }} />
              </div>
            ) : inspect.status === "idle" ? (
              <p className="notice">Queued — audits the code once Guard returns.</p>
            ) : (
              <div className="node-error">
                <span>{inspect.error?.message}</span>
                {inspect.error?.hint && <em>{inspect.error.hint}</em>}
              </div>
            )}
          </div>
        </div>
      )}

      {auditing && <div className="scanline" aria-hidden="true" />}
    </section>
  );
}

function Verdict({
  status,
  blocked,
  label,
  warn,
}: {
  status: GateState<unknown>["status"];
  blocked: boolean;
  label?: string;
  warn?: boolean;
}) {
  if (status === "running") return <span className="badge neutral">scanning</span>;
  if (status === "skipped") return <span className="badge neutral">skipped</span>;
  if (status === "error") return <span className="badge bad">error</span>;
  if (status === "idle") return <span className="badge neutral">queued</span>;
  if (blocked) return <span className="badge bad">{label ?? "flagged"}</span>;
  if (warn) return <span className="badge warn">{label ?? "suspicious"}</span>;
  return <span className="badge safe">{label ?? "clear"}</span>;
}
