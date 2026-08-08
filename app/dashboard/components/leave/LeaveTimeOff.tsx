"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  CalendarDays, Upload, Loader2, Check, X, Clock,
  FileText, ChevronLeft, ChevronRight, Plus,
} from "lucide-react";

type LeaveType = "annual" | "casual" | "sick" | "maternity" | "emergency" | "study" | "time_off";

const LEAVE_TYPES: { id: LeaveType; label: string }[] = [
  { id: "annual",    label: "Annual Leave" },
  { id: "casual",    label: "Casual Leave" },
  { id: "sick",      label: "Sick Leave" },
  { id: "maternity", label: "Maternity Leave" },
  { id: "emergency", label: "Emergency Leave" },
  { id: "study",     label: "Study Leave" },
  { id: "time_off",  label: "Time Off" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(LEAVE_TYPES.map(t => [t.id, t.label]));

interface Member { id: string; full_name: string | null; email: string | null }

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  note: string | null;
  cover_user_id: string | null;
  status: string;
  approved_start: string | null;
  approved_end: string | null;
  decline_reason: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  declined: "bg-red-500/15 text-red-400 border-red-500/25",
};

function daysBetween(a: string, b: string): number {
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Math.max(0, Math.round(d)) + 1;
}

function fmt(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Minimal inline range calendar ──
function RangeCalendar({ start, end, onPick }: {
  start: string | null; end: string | null;
  onPick: (start: string | null, end: string | null) => void;
}) {
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const first = new Date(view.y, view.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const click = (dIso: string) => {
    if (!start || (start && end)) { onPick(dIso, null); return; }
    if (dIso < start) { onPick(dIso, null); return; }
    onPick(start, dIso);
  };

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })}
          className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm text-white font-medium">{monthName}</span>
        <button type="button" onClick={() => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })}
          className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-[10px] text-zinc-600 py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dIso = iso(view.y, view.m, d);
          const isStart = dIso === start;
          const isEnd = dIso === end;
          const inRange = start && end && dIso > start && dIso < end;
          const isPast = dIso < todayIso;
          return (
            <button key={i} type="button" disabled={isPast} onClick={() => click(dIso)}
              className={`text-xs py-1.5 rounded-lg transition
                ${isStart || isEnd ? "bg-teal-500 text-[#04211E] font-semibold"
                  : inRange ? "bg-teal-500/20 text-teal-300"
                  : isPast ? "text-zinc-700 cursor-not-allowed"
                  : "text-zinc-300 hover:bg-zinc-800"}`}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaveTimeOff({
  userId, tenantId, role,
}: {
  userId: string;
  tenantId: string;
  role: string | null;
}) {
  const isManager = role === "admin" || role === "manager";

  const [members, setMembers] = useState<Member[]>([]);
  const [mine, setMine] = useState<LeaveRequest[]>([]);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [tab, setTab] = useState<"request" | "mine" | "approvals">("request");
  const [loading, setLoading] = useState(true);

  // request form
  const [ltype, setLtype] = useState<LeaveType>("annual");
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [cover, setCover] = useState<string>("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const nameFor = useCallback((id: string | null) => {
    if (!id) return "—";
    const m = members.find(x => x.id === id);
    return m?.full_name ?? m?.email ?? "Unknown";
  }, [members]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mem }, { data: myReqs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId),
      supabase.from("leave_requests").select("*").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setMembers((mem ?? []) as Member[]);
    setMine((myReqs ?? []) as LeaveRequest[]);
    if (isManager) {
      const { data: pend } = await supabase.from("leave_requests")
        .select("*").eq("tenant_id", tenantId).eq("status", "pending")
        .order("created_at", { ascending: true });
      setPending((pend ?? []) as LeaveRequest[]);
    }
    setLoading(false);
  }, [tenantId, userId, isManager]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setMsg(null);
    if (!start) { setMsg({ kind: "err", text: "Pick a start date." }); return; }
    const s = start, e = end ?? start;
    setSubmitting(true);
    try {
      const { data: reqRow, error } = await supabase.from("leave_requests").insert({
        tenant_id: tenantId, user_id: userId, leave_type: ltype,
        start_date: s, end_date: e, note: note.trim() || null,
        cover_user_id: cover || null, status: "pending",
      }).select("id").single();
      if (error) throw new Error(error.message);

      if (file && reqRow) {
        const path = `${tenantId}/${reqRow.id}/${file.name}`;
        const { error: upErr } = await supabase.storage.from("leave-documents").upload(path, file, { upsert: true });
        if (!upErr) {
          // Private bucket — store the PATH; signed URLs are generated on read.
          await supabase.from("leave_documents").insert({
            request_id: reqRow.id, tenant_id: tenantId,
            file_url: path, file_name: file.name,
          });
        }
      }

      // Fire the notify route (approval emails happen on approve; this records + notifies managers)
      await fetch("/api/leave/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqRow?.id, event: "submitted" }),
      }).catch(() => {});

      setMsg({ kind: "ok", text: "Request submitted for approval." });
      setStart(null); setEnd(null); setNote(""); setCover(""); setFile(null);
      load();
      setTab("mine");
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Could not submit." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2">
        {([["request","Request"],["mine","My Requests"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition
              ${tab === id ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            {label}
          </button>
        ))}
        {isManager && (
          <button onClick={() => setTab("approvals")}
            className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5
              ${tab === "approvals" ? "bg-white/[0.07] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
            Approvals
            {pending.length > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── REQUEST ── */}
      {tab === "request" && (
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Leave type</label>
            <div className="flex flex-wrap gap-1.5">
              {LEAVE_TYPES.map(t => (
                <button key={t.id} onClick={() => setLtype(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition
                    ${ltype === t.id ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Dates</label>
            <RangeCalendar start={start} end={end} onPick={(s, e) => { setStart(s); setEnd(e); }} />
            {start && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {fmt(start)}{end && end !== start ? ` → ${fmt(end)}` : ""} · {daysBetween(start, end ?? start)} day{daysBetween(start, end ?? start) === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Handover / cover (optional)</label>
            <select value={cover} onChange={e => setCover(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white">
              <option value="">Select a team member…</option>
              {members.filter(m => m.id !== userId).map(m => (
                <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Note / explanation</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Reason or any context for your manager…"
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white resize-none" />
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Supporting document (optional)</label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 cursor-pointer hover:border-zinc-600 text-sm text-zinc-400">
              <Upload size={14} />
              {file ? file.name : "Attach a file (e.g. doctor's report)"}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {msg && (
            <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
          )}

          <button onClick={submit} disabled={submitting || !start}
            className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-[#04211E] text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Plus size={14} /> Submit request</>}
          </button>
        </div>
      )}

      {/* ── MY REQUESTS ── */}
      {tab === "mine" && (
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          ) : mine.length === 0 ? (
            <p className="text-sm text-zinc-600 py-8 text-center">No requests yet.</p>
          ) : mine.map(r => (
            <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{TYPE_LABEL[r.leave_type] ?? r.leave_type}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-zinc-400">
                {fmt(r.start_date)}{r.end_date !== r.start_date ? ` → ${fmt(r.end_date)}` : ""}
                {r.status === "approved" && r.approved_start && (r.approved_start !== r.start_date || r.approved_end !== r.end_date) && (
                  <span className="text-emerald-400"> · approved for {fmt(r.approved_start)}{r.approved_end && r.approved_end !== r.approved_start ? ` → ${fmt(r.approved_end)}` : ""}</span>
                )}
              </p>
              {r.cover_user_id && <p className="text-[11px] text-zinc-500">Cover: {nameFor(r.cover_user_id)}</p>}
              {r.status === "declined" && r.decline_reason && (
                <p className="text-xs text-red-400/90 bg-red-500/5 rounded-lg px-2.5 py-1.5 border border-red-500/15">
                  <span className="text-red-400/60">Reason: </span>{r.decline_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── APPROVALS (manager) ── */}
      {tab === "approvals" && isManager && (
        <ApprovalsPanel
          pending={pending}
          members={members}
          nameFor={nameFor}
          userId={userId}
          onDone={load}
        />
      )}
    </div>
  );
}

// ── Manager approvals ──
function ApprovalsPanel({
  pending, members, nameFor, userId, onDone,
}: {
  pending: LeaveRequest[];
  members: Member[];
  nameFor: (id: string | null) => string;
  userId: string;
  onDone: () => void;
}) {
  if (pending.length === 0) {
    return <p className="text-sm text-zinc-600 py-8 text-center">No pending requests.</p>;
  }
  return (
    <div className="space-y-3">
      {pending.map(r => (
        <ApprovalCard key={r.id} req={r} members={members} nameFor={nameFor} userId={userId} onDone={onDone} />
      ))}
    </div>
  );
}

function ApprovalCard({
  req, members, nameFor, userId, onDone,
}: {
  req: LeaveRequest;
  members: Member[];
  nameFor: (id: string | null) => string;
  userId: string;
  onDone: () => void;
}) {
  const [aStart, setAStart] = useState(req.start_date);
  const [aEnd, setAEnd] = useState(req.end_date);
  const [cover, setCover] = useState(req.cover_user_id ?? "");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(status: "approved" | "declined") {
    if (status === "declined" && !reason.trim()) return;
    setBusy(true);
    const patch: any = {
      status, decided_by: userId, decided_at: new Date().toISOString(),
    };
    if (status === "approved") {
      patch.approved_start = aStart;
      patch.approved_end = aEnd;
      patch.cover_user_id = cover || null;
    } else {
      patch.decline_reason = reason.trim();
    }
    const { error } = await supabase.from("leave_requests").update(patch).eq("id", req.id);
    if (!error) {
      await fetch("/api/leave/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: req.id, event: status }),
      }).catch(() => {});
      onDone();
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white">{nameFor(req.user_id)}</span>
        <span className="text-xs text-zinc-500">· {TYPE_LABEL[req.leave_type] ?? req.leave_type}</span>
        <span className="text-[10px] text-zinc-600 ml-auto">requested {fmt(req.start_date)}{req.end_date !== req.start_date ? ` → ${fmt(req.end_date)}` : ""}</span>
      </div>
      {req.note && <p className="text-xs text-zinc-400 bg-zinc-950/50 rounded-lg px-2.5 py-1.5 border border-zinc-800/60">{req.note}</p>}

      {!declining ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-600 block mb-1">Approve from</label>
              <input type="date" value={aStart} min={req.start_date} max={aEnd}
                onChange={e => setAStart(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 block mb-1">Approve to</label>
              <input type="date" value={aEnd} min={aStart} max={req.end_date}
                onChange={e => setAEnd(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-600 block mb-1">Cover / handover</label>
            <select value={cover} onChange={e => setCover(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white">
              <option value="">No cover assigned</option>
              {members.filter(m => m.id !== req.user_id).map(m => (
                <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => decide("approved")} disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#04211E] text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
            </button>
            <button onClick={() => setDeclining(true)} disabled={busy}
              className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition flex items-center gap-1.5">
              <X size={13} /> Decline
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Reason for declining (sent only to the requester)…"
            className="w-full px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white resize-none" />
          <div className="flex gap-2">
            <button onClick={() => decide("declined")} disabled={busy || !reason.trim()}
              className="flex-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition disabled:opacity-50">
              {busy ? "Declining…" : "Confirm decline"}
            </button>
            <button onClick={() => { setDeclining(false); setReason(""); }} disabled={busy}
              className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-xs">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}