"use client";

import { useState } from "react";
import { evaluateSOSRisk } from "./SOSRiskEngine";
import { emitEvent } from "../../lib/event-bus/workforceBus";

interface IncidentEvaluation {
  severity: string;
  score: number;
  routing: {
    routeToHR: boolean;
    routeToSecurity: boolean;
    autoNotifyAdmin: boolean;
  };
}

export default function IncidentLogger() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<IncidentEvaluation | null>(null);

  const handleLog = () => {
    if (!text.trim()) return;

    const evaluation = evaluateSOSRisk(text);

    emitEvent({
      type: "SOS_INCIDENT_CREATED",
      payload: {
        text,
        evaluation,
        createdAt: Date.now(),
      },
      timestamp: Date.now(),
    });

    setResult(evaluation);
    setText("");
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h3 className="text-lg font-semibold">
        PivotSOS Incident Logger
      </h3>

      <textarea
        className="w-full rounded-md border p-3 outline-none"
        placeholder="Describe incident..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
      />

      <button
        onClick={handleLog}
        className="rounded-md border px-4 py-2"
      >
        Analyze Incident
      </button>

      {result && (
        <div className="rounded-md border p-3 space-y-2">
          <p>
            <strong>Severity:</strong> {result.severity}
          </p>

          <p>
            <strong>Risk Score:</strong> {result.score}
          </p>

          <div className="space-y-1">
            <p>
              <strong>Route To HR:</strong>{" "}
              {result.routing.routeToHR ? "Yes" : "No"}
            </p>

            <p>
              <strong>Route To Security:</strong>{" "}
              {result.routing.routeToSecurity ? "Yes" : "No"}
            </p>

            <p>
              <strong>Notify Admin:</strong>{" "}
              {result.routing.autoNotifyAdmin ? "Yes" : "No"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}