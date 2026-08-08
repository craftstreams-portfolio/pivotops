"use client";

import { useEffect } from "react";
import { startRealtimeListener } from "@/lib/realtime/event-listener";

export default function SystemProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // ===============================
    // START REALTIME SYSTEM
    // ===============================
    const channel = startRealtimeListener();

    console.log("🟢 PivotOps realtime system started");

    // ===============================
    // CLEANUP ON UNMOUNT
    // ===============================
    return () => {
      try {
        channel.unsubscribe();
        console.log("🔴 PivotOps realtime system stopped");
      } catch (err) {
        console.error("Realtime cleanup error:", err);
      }
    };
  }, []);

  return <>{children}</>;
}