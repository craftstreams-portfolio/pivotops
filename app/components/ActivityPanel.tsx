"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ActivityPanel() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel("activities")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
        },
        (payload) => {
          setActivities((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchActivities() {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    setActivities(data || []);
  }

  return (
    <div
      style={{
        width: 320,
        borderLeft: "1px solid #eee",
        padding: 15,
        background: "#fafafa",
        overflowY: "auto",
      }}
    >
      <h3>Activity</h3>

      {activities.map((a) => (
        <div
          key={a.id}
          style={{
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid #eee",
          }}
        >
          <strong style={{ fontSize: 13 }}>{a.title}</strong>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {a.description}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            {a.user_name} •{" "}
            {new Date(a.created_at).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}
