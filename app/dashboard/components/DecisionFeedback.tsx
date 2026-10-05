"use client";

import { useState } from "react";

import {
  storeDecision,
  DecisionRecord,
} from "../lib/decision-memory";

import { SystemAction } from "../lib/decision-engine";

type Props = {
  action: SystemAction;
};

export default function DecisionFeedback({ action }: Props) {
  const [submitted, setSubmitted] = useState(false);

  function submit(success: boolean) {
    const record: DecisionRecord = {
      id: Math.random().toString(36).slice(2),
      action,
      success,
      timestamp: Date.now(),
    };

    storeDecision(record);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-xs text-emerald-400 mt-2">
        Feedback recorded ✔
      </p>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => submit(true)}
        className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded"
      >
        Worked
      </button>

      <button
        onClick={() => submit(false)}
        className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded"
      >
        Failed
      </button>
    </div>
  );
}