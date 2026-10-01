"use client";

import { EventType } from "../lib/event-intelligence";
import { generateDecision } from "../lib/decision-engine";

type Props = {
  eventType: EventType;
};

export default function DecisionCard({ eventType }: Props) {
  const decision = generateDecision(eventType);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <p className="text-xs text-zinc-500">System Decision</p>

      <p className="text-sm font-semibold mt-1">
        {decision.action}
      </p>

      <p className="text-xs text-zinc-500 mt-1">
        {decision.reason}
      </p>

      <p className="text-xs mt-2 text-emerald-400">
        Confidence: {Math.round(decision.confidence * 100)}%
      </p>
    </div>
  );
}