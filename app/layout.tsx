import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ClientShield — sanitize client intake before it reaches an LLM",
  description:
    "A local-first gateway for messy client materials: Protect masks personal data, Guard detects prompt injection, Inspect audits supplied scripts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
