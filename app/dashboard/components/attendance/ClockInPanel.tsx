"use client";

import { useState } from "react";
import { clockIn, clockOut } from "./../pivotsos/lib/attendance-engine/session";

export default function ClockInPanel() {
  const [status, setStatus] = useState<string>("idle");

  const handleClockIn = () => {
    clockIn("user-1");
    setStatus("clocked-in");
  };

  const handleClockOut = () => {
    clockOut("user-1");
    setStatus("clocked-out");
  };

  return (
    <div>
      <h3>Clock In / Out</h3>

      <button onClick={handleClockIn}>Clock In</button>
      <button onClick={handleClockOut}>Clock Out</button>

      <p>Status: {status}</p>
    </div>
  );
}