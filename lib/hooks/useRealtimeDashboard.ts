import { useEffect } from "react";

export function useRealtimeDashboard(onUpdate: () => void) {
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      if (data.event === "DB_CHANGE") {
        onUpdate(); // refresh dashboard instantly
      }
    };

    return () => ws.close();
  }, [onUpdate]);
}