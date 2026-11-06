import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClientShield — sanitize client material before it reaches an AI",
  description:
    "A local-first sanitization gateway for agencies: mask client personal data, detect prompt injection buried in briefs, and audit the scripts clients ask you to install.",
};

const SHOTS = [
  {
    src: "/shots/workspace.png",
    alt: "ClientShield workspace: raw client brief on the left, sanitized text and threat assessment on the right",
    caption: "One paste. Three verdicts. The copy button unlocks only if the triad passes.",
  },
  {
    src: "/shots/sanitized.png",
    alt: "Sanitized text panel with token chips replacing a client name, organisation, email, phone and IP address",
    caption: "Names, emails, phones, hostnames and IPs become reversible tokens.",
  },
  {
    src: "/shots/threat.png",
    alt: "Threat assessment panel showing a blocked verdict with the flagged sentence quoted",
    caption: "The hostile sentence is quoted back to you, in place.",
  },
];

export default function PromoPage() {
  return (
    <main className="promo">
      <div className="promo-bg" aria-hidden="true" />

      <header className="promo-nav">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 2.6 20 6v6.1c0 4.4-3.3 7.9-8 9.3-4.7-1.4-8-4.9-8-9.3V6l8-3.4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8.6 11.9 11 14.3l4.5-4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="promo-wordmark">ClientShield</span>
        <span className="promo-badge">Clocked hackathon</span>
      </header>

      <section className="promo-hero">
        <p className="eyebrow">Local-first sanitization gateway</p>
        <h1>
          Client material is hostile
          <br />
          until you check it.
        </h1>
        <p className="promo-lede">
          Onboarding forms, forwarded email threads, snippets a client asks you to
          &ldquo;just drop into the footer&rdquo;. ClientShield runs each one through a
          three-gate audit before it reaches an LLM, a ticket, or a wiki — masking personal
          data, catching prompt injection, and reading code before you install it.
        </p>

        <div className="promo-stats">
          <div className="promo-stat">
            <b>10</b>
            <span>entity types masked, plus client domains</span>
          </div>
          <div className="promo-stat">
            <b>3</b>
            <span>gates, run strictly in sequence</span>
          </div>
          <div className="promo-stat">
            <b>0</b>
            <span>bytes of client text stored</span>
          </div>
        </div>
      </section>

      <section className="promo-shot promo-shot-wide">
        <div className="promo-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SHOTS[0].src} alt={SHOTS[0].alt} width={1440} height={900} loading="eager" />
        </div>
        <p className="promo-caption">{SHOTS[0].caption}</p>
      </section>

      <section className="promo-triad">
        <article className="promo-card">
          <span className="promo-glyph protect" aria-hidden="true">
            P
          </span>
          <h2>Protect</h2>
          <p>
            Finds names, emails, phone numbers, addresses, card numbers, IPs and
            internal hostnames, then replaces each with a stable token like
            <code>[CLIENT_NAME_1]</code>. The token map stays in the tab.
          </p>
        </article>
        <article className="promo-card">
          <span className="promo-glyph guard" aria-hidden="true">
            G
          </span>
          <h2>Guard</h2>
          <p>
            Scores the text for adversarial instructions — override attempts, role-play
            jailbreaks, system-prompt extraction — and quotes the exact sentence it
            flagged so you can judge it yourself.
          </p>
        </article>
        <article className="promo-card">
          <span className="promo-glyph inspect" aria-hidden="true">
            I
          </span>
          <h2>Inspect</h2>
          <p>
            Reads the tracking script, PHP block or shell command a client supplied,
            flags obfuscation, in-memory payloads and data exfiltration, and withholds
            execution when it is malicious.
          </p>
        </article>
      </section>

      <section className="promo-shot-row">
        {SHOTS.slice(1).map((shot) => (
          <figure className="promo-shot" key={shot.src}>
            <div className="promo-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.src} alt={shot.alt} width={720} height={560} loading="lazy" />
            </div>
            <figcaption className="promo-caption">{shot.caption}</figcaption>
          </figure>
        ))}
      </section>

      <section className="promo-why">
        <h2>The part that matters: the output changes what you can do</h2>
        <div className="promo-why-grid">
          <div>
            <h3>Clean material</h3>
            <p>
              The copy button unlocks and the masked text goes straight into a prompt or
              a brief — with identities replaced by reversible tokens you can map back
              locally.
            </p>
          </div>
          <div>
            <h3>Injected brief</h3>
            <p>
              Copy is disabled outright, the offending sentence is highlighted in the
              source, and the reason is stated in plain language. No override, no
              &ldquo;copy anyway&rdquo;.
            </p>
          </div>
          <div>
            <h3>Suspicious code</h3>
            <p>
              A risky <code>eval</code> does not block you — it warns. Only a malicious
              verdict withholds the snippet, so false positives stay reviewable instead
              of silently fatal.
            </p>
          </div>
        </div>
      </section>

      <section className="promo-note">
        <p>
          Built on the Clocked API. Everything runs through a server-side proxy — the
          account key never reaches the browser, gates are called one at a time to
          respect the trial tier&rsquo;s single-concurrency limit, and the reversible
          token map never leaves the tab.
        </p>
      </section>

      <footer className="promo-foot">
        <span>ClientShield</span>
        <span className="promo-dot" aria-hidden="true" />
        <span>Local-first sanitization for client-facing studios</span>
      </footer>
    </main>
  );
}
