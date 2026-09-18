"use client";

import { useEffect, useState } from "react";

import ReplayStream from "./ReplayStream";

// ===============================
// TYPES
// ===============================
type ReplayInsight = {
  eventId: string;
  severity: string;
  totalStages: number;
  averageStepTimeMs: number;
  durationMs: number;
  success: boolean;
  recommendation: string;
};

// ===============================
// COMPONENT
// ===============================
type ReplayPanelProps = {
  eventId: string;
};

export default function ReplayPanel({
  eventId,
}: ReplayPanelProps) {
  const [loading, setLoading] =
    useState(true);

  const [insight, setInsight] =
    useState<ReplayInsight | null>(
      null
    );

  // ===============================
  // FETCH REPLAY INSIGHTS
  // ===============================
  useEffect(() => {
    if (!eventId) return;

    async function loadInsights() {
      try {
        setLoading(true);

        const response =
          await fetch(
            `/api/replay/insights?eventId=${eventId}`
          );

        const data =
          await response.json();

        if (data?.data) {
          setInsight(data.data);
        }
      } catch (err: unknown) {
        console.error(
          "❌ Failed loading replay insights:",
          err
        );
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, [eventId]);

  // ===============================
  // UI
  // ===============================
  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <h2>🧠 Replay Intelligence</h2>

      <p>
        Event ID:{" "}
        <strong>{eventId}</strong>
      </p>

      {loading && (
        <p>Loading replay analysis...</p>
      )}

      {!loading && insight && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            border:
              "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <p>
            <strong>Severity:</strong>{" "}
            {insight.severity}
          </p>

          <p>
            <strong>
              Total Stages:
            </strong>{" "}
            {insight.totalStages}
          </p>

          <p>
            <strong>
              Avg Step Time:
            </strong>{" "}
            {
              insight.averageStepTimeMs
            }
            ms
          </p>

          <p>
            <strong>
              Duration:
            </strong>{" "}
            {insight.durationMs}ms
          </p>

          <p>
            <strong>Success:</strong>{" "}
            {insight.success
              ? "✅ Yes"
              : "❌ No"}
          </p>

          <p>
            <strong>
              Recommendation:
            </strong>{" "}
            {
              insight.recommendation
            }
          </p>
        </div>
      )}

      {/* =============================== */}
      {/* LIVE STREAM */}
      {/* =============================== */}
      <ReplayStream eventId={eventId} />
    </div>
  );
}
