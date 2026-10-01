"use client";

import { useEffect, useState } from "react";
import { subscribe } from "../../lib/event-bus/workforceBus";

export default function LiveOpsBoard() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      setEvents((prev) => [event, ...prev]);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h2>Live Operations Board</h2>

      {events.map((e, i) => (
        <div key={i}>
          <strong>{e.type}</strong>
          <pre>{JSON.stringify(e.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}