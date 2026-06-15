"use client";

import { useEffect, useState } from "react";

import { runSystemSupervisor } from "../lib/system-supervisor";

export default function SystemSupervisorPanel() {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setReport(runSystemSupervisor());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!report) return null;

  const color =
    report.status === "healthy"
      ? "text-emerald-400"
      : report.status === "degraded"
      ? "text-yellow-400"
      : report.status === "unstable"
      ? "text-orange-400"
      : "text-red-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-2">
        System Supervisor
      </h2>

      <p className={`text-sm font-semibold ${color}`}>
        {report.status.toUpperCase()}
      </p>

      <p className="text-xs text-zinc-400 mt-2">
        {report.summary}
      </p>

      <p className="text-xs text-zinc-500 mt-2">
        Risk Score: {Math.round(report.riskScore * 100)}%
      </p>

      <p className="text-xs mt-2 text-zinc-300">
        {report.recommendation}
      </p>
    </div>
  );
}