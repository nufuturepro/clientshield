import { NextResponse, type NextRequest } from "next/server";

import { PASS_COOKIE, issuePass, passCookieOptions, passGateEnabled, verifyPass } from "@/lib/session";

/**
 * Two jobs, no password.
 *
 * The prototype lives at an unguessable path, and simply opening it issues the
 * signed pass that the Clocked proxy requires. There is no login page: a judge
 * gets one link and starts working. Everything else — the promo page at `/` —
 * is public and never mentions that a prototype exists.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPrototype = pathname === "/p" || pathname.startsWith("/p/");
  const isProxy = pathname.startsWith("/api/clocked/");

  if (!isPrototype && !isProxy) return NextResponse.next();
  if (!passGateEnabled()) return NextResponse.next();

  const slug = process.env.PROTOTYPE_SLUG;
  const hasPass = await verifyPass(request.cookies.get(PASS_COOKIE)?.value);

  if (isProxy) {
    if (hasPass) return NextResponse.next();
    return NextResponse.json(
      {
        ok: false,
        gate: "locked",
        error: { status: 401, message: "Open the prototype link first — this proxy requires its pass." },
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const response = NextResponse.next();

  // Only the real slug mints a pass; any other path still 404s in the page.
  const onRealSlug = Boolean(slug) && (pathname === `/p/${slug}` || pathname.startsWith(`/p/${slug}/`));
  if (onRealSlug && !hasPass) {
    const pass = await issuePass();
    response.cookies.set(pass.name, pass.value, passCookieOptions(pass.maxAge));
  }

  return response;
}

export const config = {
  // Skip every /_next/* path: static chunks, images, and the dev HMR socket.
  matcher: ["/((?!_next/).*)"],
};
