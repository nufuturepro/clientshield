import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, demoLockEnabled, verifySession } from "@/lib/session";

/**
 * Only two things are gated: the prototype pages under /p/*, and the Clocked
 * proxy. The promo page at / is public, so a stranger who finds the site sees
 * marketing — not a login wall, and no hint that a prototype exists.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPrototype = pathname === "/p" || pathname.startsWith("/p/");
  const isProxy = pathname.startsWith("/api/clocked/");

  if (!isPrototype && !isProxy) return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  // No password configured: behave as before rather than locking the owner out.
  if (!demoLockEnabled()) return NextResponse.next();

  const ok = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (isProxy) {
    return NextResponse.json(
      { ok: false, gate: "locked", error: { status: 401, message: "Locked — enter the demo password." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip every /_next/* path: static chunks, images, and the dev HMR socket.
  matcher: ["/((?!_next/).*)"],
};
