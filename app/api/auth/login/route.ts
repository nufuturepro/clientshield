import { NextResponse } from "next/server";

import { createSession, passwordOk } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Small delay on failure so the endpoint can't be hammered at full speed. */
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request): Promise<Response> {
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  if (!(await passwordOk(password))) {
    await pause(450);
    return NextResponse.json(
      { ok: false, error: "Wrong password." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await createSession();
  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  response.cookies.set(session.name, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}
