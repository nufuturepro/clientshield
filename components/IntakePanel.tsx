"use client";

import { useEffect, useRef } from "react";

import { MAX_TEXT } from "@/lib/gates";
import { PRESETS } from "@/lib/presets";

export interface Highlight {
  start: number;
  end: number;
  key: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  presetId: string;
  onPreset: (id: string) => void;
  highlight: Highlight | null;
  error: string | null;
}

const LIMIT = MAX_TEXT.pii;

export function IntakePanel({
  value,
  onChange,
  onRun,
  running,
  presetId,
  onPreset,
  highlight,
  error,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    const el = ref.current;
    el.focus({ preventScroll: true });
    el.setSelectionRange(highlight.start, highlight.end);
    const ratio = highlight.start / Math.max(1, el.value.length);
    el.scrollTop = Math.max(0, ratio * el.scrollHeight - el.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.key]);

  const over = value.length > LIMIT;
  const near = !over && value.length > LIMIT * 0.8;
  const empty = value.trim().length === 0;
  const disabled = running || empty || over;

  return (
    <section className="panel intake">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Raw intake</p>
          <h2>Client material</h2>
        </div>
        <span className={`counter${over ? " bad" : near ? " warn" : ""}`}>
          {value.length.toLocaleString()} / {LIMIT.toLocaleString()}
        </span>
      </div>

      <div className="preset-row">
        <label htmlFor="preset">Demo preset</label>
        <div className="select-wrap">
          <select
            id="preset"
            value={presetId}
            onChange={(event) => onPreset(event.target.value)}
            disabled={running}
          >
            <option value="">Choose one…</option>
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 8" aria-hidden="true" className="chev">
            <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
      </div>

      <div className="textarea-wrap">
        <textarea
          ref={ref}
          value={value}
          spellCheck={false}
          placeholder="Paste a client email, feature brief, webhook payload, or a script they asked you to install…"
          onChange={(event) => onChange(event.target.value)}
          aria-label="Raw client input"
        />
        {empty && (
          <div className="textarea-hint" aria-hidden="true">
            <span className="kbd">⌘</span>
            <span className="kbd">↵</span>
            <span>or pick a preset above to see the triad fire</span>
          </div>
        )}
      </div>

      <div className="intake-foot">
        <span className="foot-note">⌘/Ctrl + ↵ to run</span>
        <div className="spacer" />
        <button
          type="button"
          className="btn ghost"
          onClick={() => onChange("")}
          disabled={running || empty}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onRun}
          disabled={disabled}
          title={over ? "Input exceeds the 60,000 character gate limit" : undefined}
        >
          {running ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Auditing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="btn-icon">
                <path
                  d="M8 1.5 13.5 4v4.2c0 3-2.3 5.4-5.5 6.3-3.2-.9-5.5-3.3-5.5-6.3V4L8 1.5Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              Run security audit
            </>
          )}
        </button>
      </div>

      {over && (
        <p className="alert bad">
          Over the limit by {(value.length - LIMIT).toLocaleString()} characters. Protect and Guard
          accept 60,000 per request.
        </p>
      )}
      {error && <p className="alert warn">{error}</p>}
    </section>
  );
}
