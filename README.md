# ClientShield

A local-first sanitization gateway for client-facing studios. Paste messy client material — an
onboarding email, a brief, a tracking snippet — and run it through three gates before it reaches an
LLM, a ticket tracker, or a shared wiki.

Built on the [Clocked](https://clocked.rezolve.ai) API (`/pii`, `/injection`, `/script`).

![ClientShield workspace](public/shots/workspace.png)

## Why

Agencies receive unvetted material daily: intake forms, forwarded threads with raw credentials,
feature briefs, third-party scripts that a client asks you to "just drop into the footer". Pasting
that into an external model or a shared tool is a privacy and security liability.

ClientShield is the middle step:

| Gate | Endpoint | Answers |
| --- | --- | --- |
| **Protect** | `/pii` | What personal data is in here, and what is the masked version? |
| **Guard** | `/injection` | Is there an instruction buried in this text that would override my prompt? |
| **Inspect** | `/script` | Is this code safe to install, or is it obfuscated / exfiltrating data? |

The output changes what the app lets you do — that is the point:

- Clean material: the copy button unlocks, and the masked text is ready for a prompt.
- Injected brief: copy is disabled, the flagged sentence is quoted back and highlighted in the source.
- Suspicious code: a warning, not a block, so a false positive stays reviewable.
- Malicious code: copy and execution are withheld.

## Architecture

```text
[ Raw client input ]
        │
        ├── Protect  → masks PII into reversible tokens ([CLIENT_NAME_1])
        ├── Guard    → scores prompt injection, returns flagged spans
        └── Inspect  → audits supplied code, returns malicious/suspicious scores
        │
        ▼
[ Sanitized text + security telemetry ]   (token map stays in the browser tab)
```

Decisions worth knowing:

- **Strictly sequential gate calls.** Clocked's trial tier allows a single concurrent request, so
  firing three at once self-inflicts 429s. The audit loop awaits each gate, and a synchronous
  in-flight lock stops a double click or repeated `Cmd+Enter` from starting a second overlapping run.
- **Server-only proxy.** `lib/clocked.ts` imports `server-only`. The account key is read from the
  environment inside a route handler and never reaches the browser — no `NEXT_PUBLIC_` prefix, no
  client import.
- **Reversible masking without mutation.** `lib/mask.ts` walks entities forward and pushes slices of
  the *untouched* input into a segment list, so replacements can never shift later offsets.
- **Gates are client-side policy.** The disabled copy button is a UI guarantee for a human operator,
  not an authorization boundary. If you expose this beyond a demo, put authentication in front of
  `/api/clocked/*` — the bundled password gate does exactly that.
- **Nothing is stored.** No database, no logs of client text. Exports are generated in the tab.

## Setup

Requirements: Node 20+ (developed on Node 24), npm.

```bash
npm install
cp .env.example .secrets.local     # then fill in the values
npm run dev
```

### Environment

Secrets live in `.secrets.local`, which is gitignored. Deliberately **not** in a `.env*` file: the
Workers build reads every `.env*` variant and inlines the values into the deployed bundle, which
would bake the API key into the artifact and shadow the platform secret.

| Variable | Purpose |
| --- | --- |
| `CLOCKED_API_KEY` | Clocked account key. Server-side only. |
| `DEMO_PASSWORD` | Password that unlocks the prototype and the proxy. Unset = gate disabled. |
| `PROTOTYPE_SLUG` | URL segment the working app is served under (`/p/<value>`). Any other value 404s. |

`next.config.ts` loads `.secrets.local` during `next dev` only.

### Routes

| Route | Behaviour |
| --- | --- |
| `/` | Public promotional page. No link to the prototype. |
| `/p/<PROTOTYPE_SLUG>` | The working app. Redirects to `/login` when signed out; 404s on any other slug. |
| `/login` | Password form; sets a 12-hour HMAC-signed, HttpOnly session cookie. |
| `/api/clocked/<gate>` | Proxy to Clocked. 401 without a session. |
| `/api/auth/login` | Password check. |

Because the slug comes from the environment, it is absent from the repository, the client bundle,
and the promo page.

## Deployment

The app builds for Cloudflare Workers through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

```bash
npx opennextjs-cloudflare build --config <wrangler-config> --openNextConfigPath <open-next-config>
```

`CLOCKED_API_KEY`, `DEMO_PASSWORD` and `PROTOTYPE_SLUG` must be set as platform secrets, not build
variables. Verify after deploying that the key does not appear in the build output:

```bash
grep -rl "$CLOCKED_API_KEY" .open-next freebuff-sites-build || echo "clean"
```

## Development history

This repository was initialised from the finished tree; the commits group the work by layer rather
than reflecting the original timeline. Later commits are real.

## Limitations

- The password gate authenticates an operator, not end users — one shared password, one 12-hour
  session, no per-user accounts.
- `looksLikeCode()` in `lib/code.ts` decides whether `/script` is worth calling. It is a regex
  heuristic: prose with a fenced code block will be sent to Inspect, and a bare one-liner may not be.
- Clocked's injection model is sensitive to second-person requests. In testing, "Can you update the
  footer links?" scored 0.91 injection while "We need the landing page rebuilt" scored 0.004. Treat a
  Guard verdict as a prompt to read the quoted sentence, which is why it is always shown.
