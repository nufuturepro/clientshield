import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ShieldApp } from "@/components/ShieldApp";

/**
 * The working prototype.
 *
 * The route segment is compared against PROTOTYPE_SLUG at request time, so the
 * public repo and the promo page never contain the real path. Any other slug
 * 404s, indistinguishable from a route that doesn't exist.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ClientShield",
  robots: { index: false, follow: false },
};

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const expected = process.env.PROTOTYPE_SLUG;

  if (!expected || slug !== expected) notFound();

  return <ShieldApp />;
}
