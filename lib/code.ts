/**
 * Decides whether an intake is worth sending to Clocked's /script gate.
 *
 * Why this exists: /script classifies whatever it receives as source code. A
 * plain prose brief — especially one containing an HTML comment — scored 0.67
 * "malicious" in testing, which reads as a false positive and buries the real
 * signal from Guard. The brief only asks Inspect to audit scripts the client
 * supplies, so prose is skipped instead.
 */
const CODE_SIGNALS: RegExp[] = [
  /<script\b/i,
  /<\/script>/i,
  /<\?php/i,
  /<%[\s\S]*?%>/,
  /^#!\//m,
  /\bfunction\s*[\w$]*\s*\(/,
  /=>\s*[{(\w]/,
  /\b(const|let|var)\s+[\w$]+\s*=/,
  /\bclass\s+[\w$]+/,
  /\beval\s*\(/,
  /\batob\s*\(/,
  /\bdocument\./,
  /\bwindow\./,
  /\bfetch\s*\(/,
  /\$_(GET|POST|REQUEST|COOKIE)\b/,
  /\bcurl\s+-/i,
  /\bwget\s+/i,
  /\bpowershell\b/i,
  /\bInvoke-Expression\b/i,
  /\brequire\s*\(/,
  /\bimport\s+.+\s+from\s+['"]/,
  /```/,
  /\bdef\s+\w+\s*\(/,
  /\bsubprocess\b/,
  /\bos\.system\b/,
  /\bexec\s*\(/,
  /\bchmod\s+\+x\b/,
  /\bnc\s+-[a-z]/i,
];

export function looksLikeCode(text: string): boolean {
  return CODE_SIGNALS.some((pattern) => pattern.test(text));
}
