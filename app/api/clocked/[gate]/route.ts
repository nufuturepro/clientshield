import { NextResponse } from "next/server";

import { ClockedError, isGate, runGate } from "@/lib/clocked";
import { MAX_TEXT } from "@/lib/gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ gate: string }>;
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const { gate } = await ctx.params;

  if (!isGate(gate)) {
    return NextResponse.json(
      {
        ok: false,
        gate,
        error: { status: 404, message: `Unknown gate "${gate}".` },
      },
      { status: 404 },
    );
  }

  let text: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json(
      { ok: false, gate, error: { status: 400, message: "Malformed JSON body." } },
      { status: 400 },
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      { ok: false, gate, error: { status: 400, message: "No input text supplied." } },
      { status: 400 },
    );
  }

  if (text.length > MAX_TEXT[gate]) {
    return NextResponse.json(
      {
        ok: false,
        gate,
        error: {
          status: 413,
          message: `Input is ${text.length.toLocaleString()} characters; this gate accepts ${MAX_TEXT[gate].toLocaleString()}.`,
        },
      },
      { status: 413 },
    );
  }

  try {
    const { data, meta } = await runGate(gate, text);
    return NextResponse.json(
      { ok: true, gate, data, meta },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    const status = err instanceof ClockedError ? err.status : 502;
    const message = err instanceof Error ? err.message : "Clocked request failed.";
    const hint = err instanceof ClockedError ? err.hint : undefined;

    // Diagnostics stay server-side; the client gets a message it can show.
    console.error(`[clientshield] ${gate} failed (${status}): ${message}`);

    return NextResponse.json(
      { ok: false, gate, error: { status, message, hint } },
      { status: status === 500 ? 500 : 502, headers: { "cache-control": "no-store" } },
    );
  }
}
