"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { buildSessions } from "@/lib/clocking/sessions";
import {
  Loader2, Award, Clock, CalendarCheck, UserPlus, Star,
  FileText, Plus, X, MessageSquarePlus,
} from "lucide-react";

interface RecordRow {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  created_by: string | null;
  created_at: string;
}

interface TimelineItem {
  key: string;
  date: string;              // ISO, for sorting
  icon: "engagement" | "hours" | "leave" | "spotlight" | "commendation" | "note" | "milestone";
  title: string;
  detail?: string | null;
  accent: string;
}

const ICONS: Record<TimelineItem["icon"], any> = {
  engagement:   UserPlus,
  hours:        Clock,
  leave:        CalendarCheck,
  spotlight:    Star,
  commendation: Award,
  note:         FileText,
  milestone:    Star,
};

const ACCENTS: Record<TimelineItem["icon"], string> = {
  engagement:   "text-sky-400 bg-sky-500/10 border-sky-500/20",
  hours:        "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  leave:        "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  spotlight:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
  commendation: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  note:         "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  milestone:    "text-teal-400 bg-teal-500/10 border-teal-500/20",
};

const TYPE_LABEL: Record<string, string> = {
  annual: "Annual Leave", casual: "Casual Leave", sick: "Sick Leave",
  maternity: "Maternity Leave", emergency: "Emergency Leave",
  study: "Study Leave", time_off: "Time Off",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDay(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function EmployeeRecords({
  userId, tenantId, role, fullName, dateJoined,
}: {
  userId: string;
  tenantId: string;
  role: string | null;
  fullName: string | null;
  dateJoined: string | null;
}) {
  const isManager = role === "admin" || role === "manager";

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [monthHours, setMonthHours] = useState<{ key: string; hours: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // add-record form (manager)
  const [adding, setAdding] = useState(false);
  const [rkind, setRkind] = useState<"commendation" | "note">("commendation");
  const [rtitle, setRtitle] = useState("");
  const [rdetail, setRdetail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const built: TimelineItem[] = [];

    // ── Approved leave ──
    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("id, leave_type, approved_start, approved_end, start_date, end_date, decided_at, status")
      .eq("tenant_id", tenantId).eq("user_id", userId).eq("status", "approved");
    for (const l of leaves ?? []) {
      const s = l.approved_start ?? l.start_date;
      const e = l.approved_end ?? l.end_date;
      built.push({
        key: `leave-${l.id}`,
        date: l.decided_at ?? s,
        icon: "leave",
        title: `Approved: ${TYPE_LABEL[l.leave_type] ?? l.leave_type}`,
        detail: `${fmtDay(s)}${e && e !== s ? ` → ${fmtDay(e)}` : ""}`,
        accent: ACCENTS.leave,
      });
    }

    // ── Spotlights (matched by name) ──
    if (fullName) {
      const { data: spots } = await supabase
        .from("spotlight_of_month")
        .select("id, month, created_at")
        .eq("tenant_id", tenantId).eq("employee_name", fullName);
      for (const sp of spots ?? []) {
        built.push({
          key: `spot-${sp.id}`,
          date: sp.created_at ?? (sp.month + "T00:00:00"),
          icon: "spotlight",
          title: "Employee of the Month",
          detail: sp.month ? new Date(sp.month + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" }) : null,
          accent: ACCENTS.spotlight,
        });
      }
    }

    // ── Logged records ──
    const { data: recs } = await supabase
      .from("employee_records")
      .select("*")
      .eq("tenant_id", tenantId).eq("user_id", userId)
      .order("created_at", { ascending: false });
    for (const r of (recs ?? []) as RecordRow[]) {
      const icon = (["commendation", "note", "milestone"].includes(r.kind) ? r.kind : "milestone") as TimelineItem["icon"];
      built.push({
        key: `rec-${r.id}`,
        date: r.created_at,
        icon,
        title: r.title,
        detail: r.detail,
        accent: ACCENTS[icon] ?? ACCENTS.milestone,
      });
    }

    // ── Monthly hours from paired clock logs ──
    const { data: logs } = await supabase
      .from("clocking_logs")
      .select("type, timestamp")
      .eq("tenant_id", tenantId).eq("user_id", userId)
      .order("timestamp", { ascending: true });

    // Hours come from the shared session builder so break time is excluded and
    // a BREAK_START can't be mistaken for the end of a shift.
    const byMonth: Record<string, number> = {};
    const { data: ws } = await supabase
      .from("workspace_settings").select("paid_breaks")
      .eq("tenant_id", tenantId).maybeSingle();
    const paidBreaks = ws?.paid_breaks === true;

    for (const s of buildSessions((logs ?? []) as any, Date.now(), { paidBreaks })) {
      if (!s.out) continue;                 // ignore shifts still open
      const hrs = s.netMs / 3600000;
      if (hrs > 0 && hrs < 24) {            // ignore anomalies (forgotten clock-outs)
        const k = monthKey(new Date(s.in.timestamp));
        byMonth[k] = (byMonth[k] ?? 0) + hrs;
      }
    }
    const monthsSorted = Object.entries(byMonth)
      .map(([key, hours]) => ({ key, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.key.localeCompare(a.key));
    setMonthHours(monthsSorted.slice(0, 6));

    // ── Date of engagement (origin) ──
    if (dateJoined) {
      built.push({
        key: "engagement",
        date: dateJoined,
        icon: "engagement",
        title: "Date of engagement",
        detail: fmtDay(dateJoined),
        accent: ACCENTS.engagement,
      });
    }

    built.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(built);
    setLoading(false);
  }, [tenantId, userId, fullName, dateJoined]);

  useEffect(() => { load(); }, [load]);

  async function addRecord() {
    if (!rtitle.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("employee_records").insert({
      tenant_id: tenantId, user_id: userId, kind: rkind,
      title: rtitle.trim(), detail: rdetail.trim() || null,
      created_by: user?.id ?? null,
    });
    if (!error) {
      setRtitle(""); setRdetail(""); setAdding(false);
      load();
    }
    setSaving(false);
  }

  const totalThisMonth = monthHours.find(m => m.key === monthKey(new Date()))?.hours ?? 0;

  return (
    <div className="space-y-5">
      {/* Hours summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] text-zinc-500 mb-1">Hours this month</p>
          <p className="text-2xl font-bold text-white">{totalThisMonth}<span className="text-sm text-zinc-500 font-normal">h</span></p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] text-zinc-500 mb-1">Approved leave (all time)</p>
          <p className="text-2xl font-bold text-white">
            {items.filter(i => i.icon === "leave").length}
          </p>
        </div>
      </div>

      {/* Per-month hours */}
      {monthHours.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] text-zinc-500 mb-3">Monthly hours (from timesheet)</p>
          <div className="space-y-2">
            {monthHours.map(m => {
              const max = Math.max(...monthHours.map(x => x.hours), 1);
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500 w-24 flex-shrink-0">{monthLabel(m.key)}</span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(m.hours / max) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-zinc-300 w-12 text-right">{m.hours}h</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manager: add to record */}
      {isManager && (
        adding ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              {(["commendation", "note"] as const).map(k => (
                <button key={k} onClick={() => setRkind(k)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border capitalize transition
                    ${rkind === k ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-zinc-800 text-zinc-400"}`}>
                  {k}
                </button>
              ))}
            </div>
            <input value={rtitle} onChange={e => setRtitle(e.target.value)} placeholder="Title (e.g. Exceeded Q3 targets)"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white" />
            <textarea value={rdetail} onChange={e => setRdetail(e.target.value)} rows={2} placeholder="Detail (optional)"
              className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white resize-none" />
            <div className="flex gap-2">
              <button onClick={addRecord} disabled={saving || !rtitle.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#211a04] text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add to record
              </button>
              <button onClick={() => { setAdding(false); setRtitle(""); setRdetail(""); }}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 transition">
            <MessageSquarePlus size={14} /> Add commendation or note
          </button>
        )
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
          <Loader2 size={15} className="animate-spin" /> Loading records…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600 py-8 text-center">No records yet.</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-zinc-800" />
          <div className="space-y-4">
            {items.map(it => {
              const Icon = ICONS[it.icon];
              return (
                <div key={it.key} className="relative">
                  <div className={`absolute -left-6 w-5 h-5 rounded-full border flex items-center justify-center ${it.accent}`}>
                    <Icon size={10} />
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{it.title}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{fmtDate(it.date)}</span>
                    </div>
                    {it.detail && <p className="text-xs text-zinc-400 mt-1">{it.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
