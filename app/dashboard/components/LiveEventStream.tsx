"use client";

import { useEffect, useState } from "react";

import {
  classifyEvent,
  generateInsight,
  calculateRisk,
  type IntelligentEvent,
} from "../lib/event-intelligence";

import DecisionCard from "./DecisionCard";

const messages = [
  "workflow success executed",
  "workflow failure detected",
  "system recovery triggered",
  "performance spike observed",
  "anomaly predict signal",
];

function createEvent(): IntelligentEvent {
  const message =
    messages[Math.floor(Math.random() * messages.length)];

  const type = classifyEvent(message);
  const insight = generateInsight(type);
  const risk = calculateRisk(type);

  return {
    id: Math.random().toString(36).slice(2),
    type,
    message,
    insight,
    risk,
    timestamp: Date.now(),
  };
}

export default function LiveEventStream() {
  const [events, setEvents] = useState<IntelligentEvent[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const event = createEvent();

      setEvents((prev) =>
        [event, ...prev].slice(0, 6)
      );
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const riskColor = (risk: IntelligentEvent["risk"]) => {
    if (risk === "high") return "text-red-400";
    if (risk === "medium") return "text-yellow-400";
    return "text-emerald-400";
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-3">
        Intelligent Event Stream
      </h2>

      <div className="space-y-5">
        {events.map((event) => (
          <div key={event.id} className="text-xs space-y-2">
            <div className="flex justify-between">
              <span>● {event.message}</span>

              <span className={riskColor(event.risk)}>
                {event.risk.toUpperCase()}
              </span>
            </div>

            <p className="text-zinc-500">
              {event.insight}
            </p>

            {/* Decision Layer (21C) */}
            <DecisionCard eventType={event.type} />
          </div>
        ))}
      </div>
    </div>
  );
}