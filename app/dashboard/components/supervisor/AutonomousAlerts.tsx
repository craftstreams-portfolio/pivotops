"use client";

import { useEffect, useState } from "react";
import { predictOperationalRisk } from "../../lib/predictive-engine/workforcePredictor";

export default function AutonomousAlerts() {
  const [risk, setRisk] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRisk(predictOperationalRisk());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!risk) return null;

  return (
    <div className="rounded-xl border p-4">
      <h2 className="text-lg font-bold">
        Autonomous Workforce Alerts
      </h2>

      <p>
        Operational Status:
        <strong> {risk.status}</strong>
      </p>

      <p>
        Risk Score:
        <strong> {risk.riskScore}</strong>
      </p>
    </div>
  );
}