"use client";

import { useState } from "react";

import type { GateState } from "@/lib/audit";
import type { PiiResult } from "@/lib/gates";
import type { MaskedDoc } from "@/lib/mask";

interface Props {
  doc: MaskedDoc;
  state: GateState<PiiResult>;
  raw: string;
}

export function PrivacyCard({ doc, state, raw }: Props) {
  const [view, setView] = useState<"masked" | "original">("masked");
  const [showMap, setShowMap] = useState(false);

  const kinds = Object.entries(doc.counts);

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-glyph protect" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path
              d="M8 1.8 13 3.7v4c0 2.8-2.1 5.1-5 6-2.9-.9-5-3.2-5-6v-4L8 1.8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M5.8 7.8 7.3 9.3 10.4 6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </span>
        <div className="card-title">
          <p className="eyebrow">Protect · privacy gate</p>
          <h3>Sanitized text</h3>
        </div>
        <div className="spacer" />
        {state.status === "ok" && (
          <div className="segmented" role="group" aria-label="Text view">
            <button
              type="button"
              className={view === "masked" ? "on" : ""}
              aria-pressed={view === "masked"}
              onClick={() => setView("masked")}
            >
              Masked
            </button>
            <button
              type="button"
              className={view === "original" ? "on" : ""}
              aria-pressed={view === "original"}
              onClick={() => setView("original")}
            >
              Original
            </button>
          </div>
        )}
      </div>

      {state.status === "idle" && (
        <div className="empty">
          <p>Nothing sanitized yet.</p>
          <span>Run an audit and the masked text lands here, token by token.</span>
        </div>
      )}

      {state.status === "running" && (
        <div className="skeleton-body" aria-hidden="true">
          <div className="skel" style={{ width: "92%" }} />
          <div className="skel" style={{ width: "78%" }} />
          <div className="skel" style={{ width: "86%" }} />
          <div className="skel" style={{ width: "54%" }} />
        </div>
      )}

      {state.status === "error" && (
        <div className="node-error">
          <strong>Protect failed.</strong>
          <span>{state.error?.message}</span>
          {state.error?.hint && <em>{state.error.hint}</em>}
        </div>
      )}

      {state.status === "ok" && (
        <>
          <div className="stat-row">
            <Stat label="entities" value={String(doc.totalEntities)} />
            <Stat label="tokens" value={String(doc.tokens.length)} />
            <Stat label="kinds" value={String(kinds.length)} />
            {state.meta?.latencyMs !== undefined && (
              <Stat label="latency" value={`${state.meta.latencyMs} ms`} />
            )}
          </div>

          {doc.totalEntities === 0 && (
            <p className="notice safe-note">
              No personal data detected in this input — nothing to mask.
            </p>
          )}

          {state.meta?.fellBackToDefaultEntities && (
            <p className="notice">
              Custom <code>domain</code> kind was rejected by Clocked; retried with the documented
              entity catalog.
            </p>
          )}

          <div className={`masked-body${view === "original" ? " original" : ""}`}>
            {raw.length === 0 ? (
              <span className="dim">empty input</span>
            ) : (
              doc.segments.map((segment, index) =>
                segment.token ? (
                  view === "masked" ? (
                    <span
                      key={index}
                      className="chip"
                      title={`${segment.token.type} · confidence ${Math.round(
                        segment.token.confidence * 100,
                      )}%`}
                    >
                      {segment.text}
                    </span>
                  ) : (
                    <mark key={index} className="revealed" title={segment.token.type}>
                      {segment.token.original}
                    </mark>
                  )
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )
            )}
          </div>

          {kinds.length > 0 && (
            <div className="kind-row">
              {kinds.map(([label, count]) => (
                <span key={label} className="kind-pill">
                  {label}
                  <b>{count}</b>
                </span>
              ))}
            </div>
          )}

          {doc.tokens.length > 0 && (
            <div className="map-block">
              <button
                type="button"
                className="map-toggle"
                onClick={() => setShowMap((open) => !open)}
                aria-expanded={showMap}
              >
                <span className={`caret${showMap ? " open" : ""}`} aria-hidden="true" />
                {showMap ? "Hide" : "Show"} reversible token map
                <span className="map-note">in browser memory only</span>
              </button>
              {showMap && (
                <div className="map-grid">
                  {doc.tokens.map((token) => (
                    <div key={token.token} className="map-row">
                      <code>{token.token}</code>
                      <span aria-hidden="true">↔</span>
                      <span className="map-value">{token.original}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
