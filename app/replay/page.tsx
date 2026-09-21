"use client";

import { useEffect } from "react";

export default function ReplayPage() {
  useEffect(() => {
    // ===============================
    // GUARD: SSR + duplicate mount safety
    // ===============================
    if (typeof window === "undefined") return;

    const eventId = "123"; // TODO: replace with route param later

    const url = `/api/replay/stream?eventId=${eventId}`;

    const es = new EventSource(url);

    // ===============================
    // CONNECTION OPEN
    // ===============================
    es.onopen = () => {
      console.log("🟢 Replay stream connected");
    };

    // ===============================
    // MESSAGE HANDLER (HARDENED)
    // ===============================
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log("📡 REPLAY STEP:", data);

        // ===============================
        // ENGINE EVENT TYPES
        // ===============================
        if (data?.type === "REPLAY_STEP") {
          // safe hook point for UI later
          return;
        }

        if (data?.type === "REPLAY_DONE") {
          console.log("✅ Replay completed:", data.eventId);
          es.close();
          return;
        }

        if (data?.type === "REPLAY_ERROR") {
          console.error("❌ Replay stream error event received");
        }
      } catch (err) {
        console.error("❌ Invalid SSE payload:", err);
      }
    };

    // ===============================
    // ERROR HANDLING (NO PAGE RELOAD LOOP BUG)
    // ===============================
    es.onerror = (err) => {
      console.error("🔥 Replay stream error:", err);

      // prevent infinite reload loop
      es.close();

      setTimeout(() => {
        console.log("🔁 Attempting reconnect...");
        window.location.href = window.location.href;
      }, 3000);
    };

    // ===============================
    // CLEANUP (CRITICAL FOR NEXT.JS)
    // ===============================
    return () => {
      console.log("🧹 Closing replay stream connection");
      es.close();
    };
  }, []);

  // ===============================
  // UI
  // ===============================
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>🔁 Replay Debug Stream</h2>
      <p>Listening to live event replay...</p>

      <div
        style={{
          marginTop: 20,
          padding: 10,
          border: "1px solid #ddd",
          borderRadius: 6,
          background: "#f9f9f9",
        }}
      >
        <strong>Status:</strong> Streaming via SSE
      </div>
    </div>
  );
}