"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ShieldCheck,
  Siren,
  Clock3,
  UserCheck,
  Activity,
} from "lucide-react";

import { emitEvent } from "../../lib/event-bus/workforceBus";
import { subscribeToWorkforceEvents } from "../../lib/realtime/workforceRealtime";
import { predictOperationalRisk } from "../../lib/predictive-engine/workforcePredictor";

interface SOSIncident {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  reportedBy: string;
  assignedResponder?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  escalationLevel?: number;
  slaDeadline?: number;
  createdAt: number;
  resolvedAt?: number;
  status:
    | "active"
    | "acknowledged"
    | "escalated"
    | "resolved";
}

export default function PivotSOSPanel() {
  const [incidents, setIncidents] = useState<SOSIncident[]>([]);
  const [loading, setLoading] = useState(false);

  const [riskScore, setRiskScore] = useState(0);
  const [riskStatus, setRiskStatus] =
    useState("stable");

  // ===============================
  // ACTIVE INCIDENTS
  // ===============================
  const activeIncidents = useMemo(() => {
    return incidents.filter(
      (incident) =>
        incident.status !== "resolved"
    );
  }, [incidents]);

  // ===============================
  // CRITICAL INCIDENTS
  // ===============================
  const criticalIncidents = useMemo(() => {
    return incidents.filter(
      (incident) =>
        incident.severity === "critical" &&
        incident.status !== "resolved"
    );
  }, [incidents]);

  // ===============================
  // REALTIME + AI RISK
  // ===============================
  useEffect(() => {
    const interval = setInterval(() => {
      const risk =
        predictOperationalRisk();

      setRiskScore(risk.riskScore);
      setRiskStatus(risk.status);
    }, 3000);

    const realtimeChannel =
      subscribeToWorkforceEvents(
        (payload: any) => {
          // ===============================
          // INCIDENT CREATED
          // ===============================
          if (
            payload?.event ===
            "SOS_INCIDENT_CREATED"
          ) {
            const incomingIncident =
              payload.payload as SOSIncident;

            setIncidents((prev) => [
              incomingIncident,
              ...prev,
            ]);
          }

          // ===============================
          // INCIDENT UPDATED
          // ===============================
          if (
            payload?.event ===
            "SOS_INCIDENT_UPDATED"
          ) {
            const updatedIncident =
              payload.payload as SOSIncident;

            setIncidents((prev) =>
              prev.map((incident) =>
                incident.id ===
                updatedIncident.id
                  ? updatedIncident
                  : incident
              )
            );
          }
        }
      );

    return () => {
      clearInterval(interval);

      realtimeChannel.unsubscribe();
    };
  }, []);

  // ===============================
  // CREATE INCIDENT
  // ===============================
  async function createSOSIncident() {
    setLoading(true);

    try {
      const incident: SOSIncident = {
        id: crypto.randomUUID(),

        title:
          "Emergency Workforce Alert",

        severity: "critical",

        location:
          "Operations Floor",

        reportedBy:
          "PivotOps Supervisor",

        assignedResponder:
          "Emergency Response Team",

        escalationLevel: 1,

        slaDeadline:
          Date.now() + 1000 * 60 * 15,

        createdAt: Date.now(),

        status: "active",
      };

      await emitEvent({
        type:
          "SOS_INCIDENT_CREATED",

        payload: incident,

        timestamp: Date.now(),
      });

      setIncidents((prev) => [
        incident,
        ...prev,
      ]);
    } catch (error) {
      console.error(
        "Failed to create SOS incident",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  // ===============================
  // ACKNOWLEDGE INCIDENT
  // ===============================
  async function acknowledgeIncident(
    id: string
  ) {
    const incident =
      incidents.find(
        (item) => item.id === id
      );

    if (!incident) return;

    const updatedIncident: SOSIncident =
      {
        ...incident,

        acknowledgedBy:
          "Operations Commander",

        acknowledgedAt:
          Date.now(),

        status: "acknowledged",
      };

    await emitEvent({
      type:
        "SOS_INCIDENT_UPDATED",

      payload: updatedIncident,

      timestamp: Date.now(),
    });

    setIncidents((prev) =>
      prev.map((item) =>
        item.id === updatedIncident.id
          ? updatedIncident
          : item
      )
    );
  }

  // ===============================
  // ESCALATE INCIDENT
  // ===============================
  async function escalateIncident(
    id: string
  ) {
    const incident =
      incidents.find(
        (item) => item.id === id
      );

    if (!incident) return;

    const updatedIncident: SOSIncident =
      {
        ...incident,

        escalationLevel:
          (incident.escalationLevel ??
            1) + 1,

        status: "escalated",
      };

    await emitEvent({
      type:
        "SOS_INCIDENT_UPDATED",

      payload: updatedIncident,

      timestamp: Date.now(),
    });

    setIncidents((prev) =>
      prev.map((item) =>
        item.id === updatedIncident.id
          ? updatedIncident
          : item
      )
    );
  }

  // ===============================
  // RESOLVE INCIDENT
  // ===============================
  async function resolveIncident(
    id: string
  ) {
    const incident =
      incidents.find(
        (item) => item.id === id
      );

    if (!incident) return;

    const updatedIncident: SOSIncident =
      {
        ...incident,

        resolvedAt: Date.now(),

        status: "resolved",
      };

    await emitEvent({
      type:
        "SOS_INCIDENT_UPDATED",

      payload: updatedIncident,

      timestamp: Date.now(),
    });

    setIncidents((prev) =>
      prev.map((item) =>
        item.id === updatedIncident.id
          ? updatedIncident
          : item
      )
    );
  }

  // ===============================
  // SLA TIMER
  // ===============================
  function getSLATimeRemaining(
    deadline?: number
  ) {
    if (!deadline)
      return "No SLA";

    const diff =
      deadline - Date.now();

    if (diff <= 0)
      return "SLA Breached";

    const minutes = Math.floor(
      diff / 1000 / 60
    );

    return `${minutes} mins`;
  }

  // ===============================
  // STATUS COLORS
  // ===============================
  function getStatusStyles(
    status: SOSIncident["status"]
  ) {
    switch (status) {
      case "active":
        return "border-red-300 bg-red-50 text-red-600";

      case "acknowledged":
        return "border-yellow-300 bg-yellow-50 text-yellow-700";

      case "escalated":
        return "border-orange-300 bg-orange-50 text-orange-700";

      case "resolved":
        return "border-emerald-300 bg-emerald-50 text-emerald-700";

      default:
        return "border-neutral-300 bg-neutral-50 text-neutral-700";
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
              <Siren size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">
                PivotSOS Command Center
              </h2>

              <p className="text-sm text-zinc-400">
                Enterprise emergency operations infrastructure.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={createSOSIncident}
          disabled={loading}
          className="rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Creating Incident..."
            : "Trigger SOS Incident"}
        </button>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Active Incidents
            </p>

            <AlertTriangle
              size={18}
              className="text-red-400"
            />
          </div>

          <h3 className="mt-3 text-3xl font-bold text-white">
            {activeIncidents.length}
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Critical Incidents
            </p>

            <ShieldCheck
              size={18}
              className="text-orange-400"
            />
          </div>

          <h3 className="mt-3 text-3xl font-bold text-white">
            {criticalIncidents.length}
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Operational Risk
            </p>

            <Activity
              size={18}
              className="text-emerald-400"
            />
          </div>

          <h3 className="mt-3 text-3xl font-bold capitalize text-white">
            {riskStatus}
          </h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Risk Score
            </p>

            <Clock3
              size={18}
              className="text-blue-400"
            />
          </div>

          <h3 className="mt-3 text-3xl font-bold text-white">
            {riskScore}
          </h3>
        </div>
      </div>

      {/* INCIDENT LIST */}
      <div className="space-y-4">

        {incidents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-500">
            No active workforce incidents detected.
          </div>
        ) : (
          incidents.map((incident) => (
            <div
              key={incident.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

                {/* LEFT */}
                <div className="space-y-3">

                  <div className="flex flex-wrap items-center gap-3">

                    <h3 className="text-xl font-semibold text-white">
                      {incident.title}
                    </h3>

                    <span className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase text-zinc-300">
                      {incident.severity}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusStyles(
                        incident.status
                      )}`}
                    >
                      {incident.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">

                    <p className="text-sm text-zinc-400">
                      Location:
                      <span className="ml-2 text-white">
                        {incident.location}
                      </span>
                    </p>

                    <p className="text-sm text-zinc-400">
                      Reported By:
                      <span className="ml-2 text-white">
                        {incident.reportedBy}
                      </span>
                    </p>

                    <p className="text-sm text-zinc-400">
                      Assigned Responder:
                      <span className="ml-2 text-white">
                        {incident.assignedResponder}
                      </span>
                    </p>

                    <p className="text-sm text-zinc-400">
                      Escalation Level:
                      <span className="ml-2 text-white">
                        L
                        {
                          incident.escalationLevel
                        }
                      </span>
                    </p>

                    <p className="text-sm text-zinc-400">
                      SLA Remaining:
                      <span className="ml-2 text-white">
                        {getSLATimeRemaining(
                          incident.slaDeadline
                        )}
                      </span>
                    </p>
                  </div>

                  {incident.acknowledgedBy && (
                    <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                      <UserCheck size={16} />

                      Acknowledged by{" "}
                      {
                        incident.acknowledgedBy
                      }
                    </div>
                  )}

                  <p className="text-xs text-zinc-500">
                    Created:
                    {" "}
                    {new Date(
                      incident.createdAt
                    ).toLocaleString()}
                  </p>
                </div>

                {/* RIGHT */}
                <div className="flex flex-wrap gap-3">

                  {incident.status ===
                    "active" && (
                    <button
                      onClick={() =>
                        acknowledgeIncident(
                          incident.id
                        )
                      }
                      className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-300 transition hover:bg-yellow-500/20"
                    >
                      Acknowledge
                    </button>
                  )}

                  {(incident.status ===
                    "active" ||
                    incident.status ===
                      "acknowledged") && (
                    <button
                      onClick={() =>
                        escalateIncident(
                          incident.id
                        )
                      }
                      className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-500/20"
                    >
                      Escalate
                    </button>
                  )}

                  {incident.status !==
                    "resolved" && (
                    <button
                      onClick={() =>
                        resolveIncident(
                          incident.id
                        )
                      }
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}