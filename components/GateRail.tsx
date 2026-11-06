"use client";

import { GATE_BLURB, GATE_LABEL, GATES, type GateName } from "@/lib/gates";
import type { GateState } from "@/lib/audit";

interface Props {
  states: Record<GateName, GateState<unknown>>;
}

function toneFor(status: GateState<unknown>["status"]): string {
  switch (status) {
    case "running":
      return "running";
    case "ok":
      return "ok";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export function GateRail({ states }: Props) {
  return (
    <div className="gate-rail" aria-label="Endpoint status">
      {GATES.map((gate) => {
        const status = states[gate].status;
        return (
          <div
            key={gate}
            className="gate-chip"
            data-tone={toneFor(status)}
            title={`${GATE_LABEL[gate]} — ${GATE_BLURB[gate]}`}
          >
            <span className="dot" aria-hidden="true" />
            <span className="gate-name">{GATE_LABEL[gate]}</span>
            <span className="gate-state">{status === "idle" ? "queued" : status}</span>
          </div>
        );
      })}
    </div>
  );
}
