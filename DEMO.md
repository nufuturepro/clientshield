# ClientShield — 3 minute demo

Setup before you start: `npm run dev`, open http://localhost:3000, browser **at least 1280px wide**
(below 1120px the split-screen collapses to a single column). Keep the Console closed. Each audit
lands in about a second, so there is no dead air to fill.

**Use ⌘/Ctrl + Enter to run, not the mouse.** The Run button gets missed by pointer clicks in some
embedded previews; the keyboard shortcut always fires.

---

## 0. The problem — 10 seconds

> "Consultants get client material by email — intake forms, briefs, tracking scripts. The instinct
> is to paste it into an LLM to summarise, or drop the script into WordPress. Both are a liability.
> ClientShield runs it through three detection endpoints before either happens."

Point at the left panel: raw intake. Right: the sanitized workstation.

---

## 1. Onboarding email — Protect — 35 seconds

Pick **Messy client onboarding email**, run.

> "An ordinary intake mail. Four names, three email addresses, two phone numbers, a date of birth,
> an office IP, two client domains."

Watch: **14 entities masked**, chips `[CLIENT_NAME_1]`, `[EMAIL_1]`, `[ORG_1]`, `[DOMAIN_1]`.
Risk 0. Copy **enabled**.

Click **Original** → same text, entities highlighted, no second API call.
Click **Show reversible token map** → `[CLIENT_NAME_1] ↔ Marta Halvorsen`.

> "The map is in browser memory only. Never written to disk, never in the export. That's what makes
> it reversible locally without shipping identities back over the wire."

**Proves:** Protect runs, and its output changes what you can do — the copy button unlocks.

---

## 2. Injection brief — Guard — 40 seconds

Pick **Brief with embedded prompt injection**, run.

> "Same kind of brief. Except there's a hostile comment buried in it."

Watch: Guard goes red — **`injection`, 0.9951**, `instruction override`, severity critical, **4
evidence spans**. The hostile sentence is **already selected in the raw textarea** on the left, so
you can point straight at it.

Copy button is now **disabled**, and the reason is written on it:
*"Guard detected a prompt injection (instruction override)."*

> "This is the part that matters: the endpoint's output changes what the application does. The safe
> path is closed, and it says why."

**Proves:** Guard is wired to behaviour, not just a badge.

---

## 3. Analytics script — Inspect — 40 seconds

Pick **Analytics script with obfuscated payload**, run.

Watch: Inspect red — **malicious 0.988**, `obfuscated or in-memory payload`, critical, **7 spans**.
Guard stays benign (0.028) — the threat here is code, not instructions.

Click **Export markdown**, open it:

```
[WITHHELD — flagged by Inspect: obfuscated or in-memory payload]
```

> "The code never makes it into the artifact. You get the surrounding brief, safely, and a marker
> saying what was removed and why."

**Proves:** Inspect gated the copy, and the withholding is visible in the export — not just hidden
behind a disabled button.

---

## 4. Risky eval — the in-between — 35 seconds

Pick **Legacy script with a risky eval**, run.

Watch: Inspect **amber**, verdict **`review`**, suspicious **0.908** but malicious **0.002** — it
evaluates a config and pulls a remote stylesheet, with no exfiltration. Risk 91 / caution.

Copy is **allowed**, with an amber line: *"Review recommended — Inspect flagged this code as
suspicious, but not malicious."*

> "This is deliberate. A blunt blocklist would refuse this and you'd learn to ignore it. The app
> acts on the score: suspicious warns, malicious blocks."

**Proves:** the triad produces graded decisions, not a binary.

---

## Closer — 15 seconds

> "Three endpoints, three different actions. Protect rewrites the text, Guard closes the safe path,
> Inspect withholds the code. The API key lives server-side in a thin proxy, the calls run
> sequentially because the plan allows one at a time, and the token map never leaves the tab.
> Roughly 20 credits per audit."

---

## If they ask

**"Is the client data leaving the machine?"** Yes, to Clocked — that's the sanitiser. What stays
local is the token map, the results, and every export. The copy path is what's raw-PII-free.

**"Why sequential?"** The Trial plan allows one concurrent request; firing three at once
self-inflicts 429s.

**"Why did Inspect skip the first two?"** `/script` reads whatever it's given as source code, so
prose scores as suspicious — a plain brief came back 0.67 "malicious" in testing. It only runs on
code-shaped input, which also saves credits.

**"What if Guard and Inspect disagree?"** Either one can block. The reason shown names whichever
fired, and the risk score takes the worse of the two.
