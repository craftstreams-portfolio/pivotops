"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const STATUSES = [
  "new",
  "screening",
  "assessment",
  "interview",
  "recruitment_review",
  "rejected",
];

export default function AnalyticsPanel() {
  const [stats, setStats] = useState<any>({
    total: 0,
    byStatus: {},
    decisions: { HIRE: 0, REJECT: 0, REVIEW: 0 },
  });

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("status, decision");

      if (error || !mounted) return;

      const total = data.length;

      const byStatus: Record<string, number> = {};
      const decisions = { HIRE: 0, REJECT: 0, REVIEW: 0 };

      for (const s of STATUSES) byStatus[s] = 0;

      data.forEach((c: any) => {
        if (c.status) {
          byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        }

        if (c.decision === "HIRE") decisions.HIRE++;
        else if (c.decision === "REJECT") decisions.REJECT++;
        else decisions.REVIEW++;
      });

      setStats({ total, byStatus, decisions });
    };

    loadStats();

    const channel = supabase
      .channel("analytics-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        loadStats
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid #e5e7eb",
        background: "white",
      }}
    >
      <h3 style={{ marginBottom: 10 }}>📊 Hiring Analytics</h3>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <strong>Total:</strong> {stats.total}
        </div>

        <div>
          <strong>Hired:</strong> {stats.decisions.HIRE}
        </div>

        <div>
          <strong>Rejected:</strong> {stats.decisions.REJECT}
        </div>

        <div>
          <strong>In Review:</strong> {stats.decisions.REVIEW}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {Object.entries(stats.byStatus).map(([key, val]: any) => (
          <div key={key} style={{ fontSize: 12 }}>
            {key}: {val}
          </div>
        ))}
      </div>
    </div>
  );
}