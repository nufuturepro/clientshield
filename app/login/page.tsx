"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Wrong password.");
        setBusy(false);
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(target);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  };

  return (
    <main className="lock">
      <form className="lock-card" onSubmit={submit}>
        <span className="lock-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 2.6 20 6v6.1c0 4.4-3.3 7.9-8 9.3-4.7-1.4-8-4.9-8-9.3V6l8-3.4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M9.4 11.8v-1.3a2.6 2.6 0 0 1 5.2 0v1.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <rect x="8.6" y="11.8" width="6.8" height="4.6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>

        <h1>ClientShield</h1>
        <p className="lock-sub">Contest demo — enter the password to continue.</p>

        <label className="lock-label" htmlFor="demo-password">
          Password
          <input
            id="demo-password"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            spellCheck={false}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="alert bad" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn primary lock-submit" disabled={busy || !password}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Checking…
            </>
          ) : (
            "Unlock"
          )}
        </button>

        <p className="lock-foot">
          Session lasts 12 hours. Nothing is sent anywhere but this app.
        </p>
      </form>
    </main>
  );
}
