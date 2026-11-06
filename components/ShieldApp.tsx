"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionBar } from "@/components/ActionBar";
import { GateRail } from "@/components/GateRail";
import { IntakePanel, type Highlight } from "@/components/IntakePanel";
import { PrivacyCard } from "@/components/PrivacyCard";
import { SafetyCard } from "@/components/SafetyCard";
import {
  IDLE_AUDIT,
  auditTotals,
  callGate,
  type AuditState,
  type GateState,
} from "@/lib/audit";
import { looksLikeCode } from "@/lib/code";
import {
  buildAuditJson,
  buildMarkdown,
  buildSafeCopy,
  copyToClipboard,
  downloadFile,
} from "@/lib/export";
import type {
  GateName,
  GateResponse,
  InjectionResult,
  PiiResult,
  ScriptResult,
} from "@/lib/gates";
import { GATES } from "@/lib/gates";
import { buildMaskedDoc } from "@/lib/mask";
import { PRESETS } from "@/lib/presets";
import { copyBlockedReason, inspectSuspicious } from "@/lib/verdict";

function withResult(state: AuditState, res: GateResponse<unknown>): AuditState {
  switch (res.gate) {
    case "pii":
      return {
        ...state,
        pii: res.ok
          ? { status: "ok", data: res.data as PiiResult, meta: res.meta }
          : { status: "error", error: res.error },
      };
    case "injection":
      return {
        ...state,
        injection: res.ok
          ? { status: "ok", data: res.data as InjectionResult, meta: res.meta }
          : { status: "error", error: res.error },
      };
    case "script":
      return {
        ...state,
        script: res.ok
          ? { status: "ok", data: res.data as ScriptResult, meta: res.meta }
          : { status: "error", error: res.error },
      };
  }
}

function running(state: AuditState, gate: GateName): AuditState {
  const next: GateState<unknown> = { status: "running" };
  return { ...state, [gate]: next } as AuditState;
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function ShieldApp() {
  const [raw, setRaw] = useState("");
  const [auditedText, setAuditedText] = useState("");
  const [presetId, setPresetId] = useState("");
  const [audit, setAudit] = useState<AuditState>(IDLE_AUDIT);
  const [runningAudit, setRunningAudit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  // Synchronous lock. `runningAudit` alone can't stop a double click or two
  // fast Cmd+Enter repeats: both handlers close over the same render's
  // `runningAudit: false`, so two audit loops start and overlap — which
  // self-inflicts 429s against Trial's concurrency of 1.
  const inFlight = useRef(false);

  const doc = useMemo(
    () => buildMaskedDoc(auditedText, audit.pii.data?.entities ?? []),
    [auditedText, audit.pii.data],
  );

  const totals = auditTotals(audit);
  const anyRan = GATES.some((gate) => audit[gate].status !== "idle");
  const stale = auditedText.length > 0 && raw !== auditedText;
  const blocked = copyBlockedReason(audit.injection.data, audit.script.data);
  const ready = audit.pii.status === "ok" && !stale;

  let blockedReason: string | null = null;
  if (anyRan) {
    if (audit.pii.status === "error") {
      blockedReason = "Protect failed — copy is disabled so raw personal data can't slip through.";
    } else if (audit.pii.status !== "ok") {
      blockedReason = "Protect hasn't finished clearing this text.";
    } else if (stale) {
      blockedReason = "Input changed since this audit. Re-run before copying.";
    } else if (blocked) {
      blockedReason = blocked;
    }
  }

  // Allowed through, but Inspect wants a human to look at the code.
  const warning =
    anyRan && !blockedReason && inspectSuspicious(audit.script.data)
      ? "Review recommended — Inspect flagged this code as suspicious, but not malicious."
      : null;

  const run = useCallback(async () => {
    const text = raw;
    if (!text.trim() || inFlight.current) return;
    inFlight.current = true;

    setRunningAudit(true);
    setCopied(false);
    setHighlight(null);
    setAudit(IDLE_AUDIT);
    setAuditedText(text);

    // /script reads whatever it gets as source code, so a prose brief scores as
    // suspicious. Only audit code-shaped input.
    const inspectApplies = looksLikeCode(text);

    // Sequential on purpose: Clocked's Trial concurrency is 1, so firing all
    // three at once would self-inflict 429s. Each gate's request is fully
    // settled before the next one is sent.
    try {
      for (const gate of GATES) {
        if (gate === "script" && !inspectApplies) {
          setAudit((state) => ({
            ...state,
            script: { status: "skipped", note: "No code-shaped content in this input." },
          }));
          continue;
        }

        setAudit((state) => running(state, gate));
        const res = await callGate(gate, text);
        setAudit((state) => withResult(state, res));

        if (gate === "injection" && res.ok) {
          const first = (res.data as InjectionResult).evidence?.[0];
          if (first) setHighlight({ start: first.start, end: first.end, key: Date.now() });
        }
      }
    } finally {
      inFlight.current = false;
      setRunningAudit(false);
    }
  }, [raw]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const onPreset = (id: string) => {
    setPresetId(id);
    const preset = PRESETS.find((item) => item.id === id);
    if (preset) {
      setRaw(preset.text);
      setAudit(IDLE_AUDIT);
      setAuditedText("");
      setHighlight(null);
      setCopied(false);
    }
  };

  const onCopy = async () => {
    const safe = buildSafeCopy(doc.masked, audit.script.data);
    const ok = await copyToClipboard(safe);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const snapshot = () => ({
    raw: auditedText,
    masked: doc,
    state: audit,
    createdAt: new Date(),
  });

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M12 2.6 20 6v6.1c0 4.4-3.3 7.9-8 9.3-4.7-1.4-8-4.9-8-9.3V6l8-3.4Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8.6 11.9 11 14.3l4.5-4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div className="brand-text">
            <h1>ClientShield</h1>
            <p>Local-first sanitization gateway</p>
          </div>
        </div>

        <GateRail states={audit} />

        <div className="pill-row">
          <span className="pill" title="Credits billed for this audit, read from Clocked's response headers">
            <b>{totals.credits || "—"}</b> credits
          </span>
          <span className="pill" title="Total wall-clock time across the gates">
            <b>{totals.latencyMs ? totals.latencyMs.toLocaleString() : "—"}</b> ms
          </span>
        </div>
      </header>

      <div className="shell">
        <IntakePanel
          value={raw}
          onChange={(value) => {
            setRaw(value);
            setCopied(false);
            if (value === "") {
              // Clearing the input must clear the workspace with it, or the
              // right-hand cards and credit pills describe text that is gone.
              setPresetId("");
              setAudit(IDLE_AUDIT);
              setAuditedText("");
              setHighlight(null);
            }
          }}
          onRun={run}
          running={runningAudit}
          presetId={presetId}
          onPreset={onPreset}
          highlight={highlight}
          error={null}
        />

        <div className="right-col">
          <PrivacyCard doc={doc} state={audit.pii} raw={auditedText} />

          <SafetyCard
            guard={audit.injection}
            inspect={audit.script}
            raw={auditedText}
            auditing={runningAudit}
            onLocate={(start, end) => setHighlight({ start, end, key: Date.now() })}
          />

          <ActionBar
            onCopy={onCopy}
            onExportMarkdown={() =>
              downloadFile(
                `clientshield-${stamp()}.md`,
                buildMarkdown(snapshot()),
                "text/markdown;charset=utf-8",
              )
            }
            onDownloadJson={() =>
              downloadFile(
                `clientshield-${stamp()}-audit.json`,
                JSON.stringify(buildAuditJson(snapshot()), null, 2),
                "application/json",
              )
            }
            blockedReason={blockedReason}
            warning={warning}
            copied={copied}
            ready={ready}
          />

          <p className="privacy-note">
            Text is sent to Clocked for analysis. The reversible token map and every export stay in
            this tab — nothing is written to disk or a database.
          </p>
        </div>
      </div>
    </main>
  );
}
