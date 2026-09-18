"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/dashboard/metrics");
      const data = await res.json();
      setMetrics(data);
    }
    load();
  }, []);

  if (!metrics) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  // ─────────────────────────────────────────
  // EXECUTIVE INSIGHTS
  // ─────────────────────────────────────────
  const executiveInsights = [
    {
      label: "Automation Savings",
      value: `$${metrics.automationSavings?.value?.toLocaleString() ?? 0}`,
      sub: `+${metrics.automationSavings?.percent ?? 0}%`,
    },
    {
      label: "Workflow Accuracy",
      value: `${metrics.workflowAccuracy?.percent ?? 0}%`,
      sub: `+${metrics.workflowAccuracy?.delta ?? 0}%`,
    },
    {
      label: "Recruiter Productivity",
      value: metrics.recruiterProductivity?.label ?? "N/A",
      sub: "System baseline",
    },
  ];

  // ─────────────────────────────────────────
  // CORE METRICS
  // ─────────────────────────────────────────
  const coreMetrics = [
    {
      label: "Candidates in Pipeline",
      value: metrics.candidatesInPipeline,
    },
    {
      label: "Weekly Applications",
      value: metrics.weeklyApplications,
    },
    {
      label: "Drop-off Rate",
      value: `${metrics.dropoffRate}%`,
    },
    {
      label: "Offers Sent",
      value: metrics.offersSent,
    },
    {
      label: "Fill Rate",
      value: `${metrics.fillRate}%`,
    },
    {
      label: "Open Tasks",
      value: metrics.openTasks,
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">PivotOps Dashboard</h1>
        <p className="text-gray-500">
          Workforce intelligence & hiring operations overview
        </p>
      </div>

      {/* EXECUTIVE LAYER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {executiveInsights.map((item, i) => (
          <div key={i} className="border rounded-xl p-4">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-xs text-green-500">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* CORE METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {coreMetrics.map((item, i) => (
          <div key={i} className="border rounded-xl p-4">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-3xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}