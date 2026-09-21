"use client";

import { useEffect, useState } from "react";
import { getLedgerEvents } from "../../lib/event-bus/workforceLedger";

export default function AuditTrailPanel() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents([...getLedgerEvents()]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Operational Audit Trail</h2>

      {events.map((event) => (
        <div
          key={event.id}
          style={{
            border: "1px solid #333",
            padding: 10,
            marginBottom: 10,
          }}
        >
          <strong>{event.type}</strong>

          <pre>
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
