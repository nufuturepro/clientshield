"use client";

interface Props {
  onCopy: () => void;
  onExportMarkdown: () => void;
  onDownloadJson: () => void;
  blockedReason: string | null;
  warning: string | null;
  copied: boolean;
  ready: boolean;
}

export function ActionBar({
  onCopy,
  onExportMarkdown,
  onDownloadJson,
  blockedReason,
  warning,
  copied,
  ready,
}: Props) {
  const tone = blockedReason ? "bad" : warning ? "warn" : ready ? "safe" : "neutral";

  return (
    <div className="action-bar">
      <div className="action-status" data-tone={tone}>
        <span className="status-glyph" aria-hidden="true">
          {blockedReason ? (
            <svg viewBox="0 0 16 16">
              <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          ) : ready ? (
            <svg viewBox="0 0 16 16">
              <path d="M3 8.6 6.2 11.8 13 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          )}
        </span>
        <span className="status-text">
          {blockedReason ??
            warning ??
            (ready ? "Cleared — safe to paste into an LLM" : "Run an audit to unlock the safe copy")}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn ghost" onClick={onExportMarkdown} disabled={!ready}>
          Export markdown
        </button>
        <button type="button" className="btn ghost" onClick={onDownloadJson} disabled={!ready}>
          Audit log
        </button>
        <button
          type="button"
          className="btn primary copy"
          onClick={onCopy}
          disabled={!ready || Boolean(blockedReason)}
          title={blockedReason ?? "Copy the masked text, script withheld if flagged"}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="btn-icon">
                <path d="M3 8.6 6.2 11.8 13 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="btn-icon">
                <rect x="3" y="4.6" width="7.2" height="8.4" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path d="M6 3.4h5.4A1.6 1.6 0 0 1 13 5v6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Copy safe text
            </>
          )}
        </button>
      </div>
    </div>
  );
}
