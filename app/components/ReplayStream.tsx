"use client";

import { useEffect, useRef, useState } from "react";

// ===============================
// TYPES
// ===============================
type ReplayMessage = {
  type?: string;
  eventId?: string;
  stage?: string;
  timestamp?: number;
  payload?: Record<string, unknown>;
};

// ===============================
// COMPONENT
// ===============================
type ReplayStreamProps = {
  eventId: string;
};

export default function ReplayStream({
  eventId,
}: ReplayStreamProps) {
  const [connected, setConnected] =
    useState(false);

  const [messages, setMessages] =
    useState<ReplayMessage[]>([]);

  const eventSourceRef =
    useRef<EventSource | null>(null);

  // ===============================
  // STREAM CONNECTION
  // ===============================
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !eventId
    ) {
      return;
    }

    const url =
      `/api/replay/stream?eventId=${eventId}`;

    const es = new EventSource(url);

    eventSourceRef.current = es;

    // ===============================
    // OPEN
    // ===============================
    es.onopen = () => {
      console.log(
        "🟢 Replay stream connected"
      );

      setConnected(true);
    };

    // ===============================
    // MESSAGE
    // ===============================
    es.onmessage = (event) => {
      try {
        const parsed: ReplayMessage =
          JSON.parse(event.data);

        console.log(
          "📡 Replay message:",
          parsed
        );

        setMessages((prev) => [
          parsed,
          ...prev,
        ]);

        // ===============================
        // AUTO CLOSE ON DONE
        // ===============================
        if (
          parsed?.type ===
          "REPLAY_DONE"
        ) {
          es.close();
          setConnected(false);
        }
      } catch (err: unknown) {
        console.error(
          "❌ Invalid replay payload:",
          err
        );
      }
    };

    // ===============================
    // ERROR
    // ===============================
    es.onerror = (err) => {
      console.error(
        "🔥 Replay stream failed:",
        err
      );

      setConnected(false);

      es.close();
    };

    // ===============================
    // CLEANUP
    // ===============================
    return () => {
      console.log(
        "🧹 Closing replay stream"
      );

      es.close();

      eventSourceRef.current = null;
    };
  }, [eventId]);

  // ===============================
  // UI
  // ===============================
  return (
    <div
      style={{
        marginTop: 20,
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3>📡 Replay Stream</h3>

      <p>
        Status:{" "}
        {connected
          ? "🟢 Connected"
          : "🔴 Disconnected"}
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
        }}
      >
        {messages.map(
          (message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              style={{
                padding: 10,
                border:
                  "1px solid #e5e5e5",
                borderRadius: 6,
                background: "#fafafa",
              }}
            >
              <div>
                <strong>Type:</strong>{" "}
                {message.type ??
                  "UNKNOWN"}
              </div>

              <div>
                <strong>Stage:</strong>{" "}
                {message.stage ??
                  "N/A"}
              </div>

              <div>
                <strong>Event:</strong>{" "}
                {message.eventId ??
                  "N/A"}
              </div>

              <div>
                <strong>Time:</strong>{" "}
                {message.timestamp
                  ? new Date(
                      message.timestamp
                    ).toLocaleTimeString()
                  : "N/A"}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
