"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, UserCheck, CheckCircle2, XCircle, Globe } from "lucide-react";

// Renders only for support inquiry channels. Returns null for every normal
// channel, so it can be mounted unconditionally in the Teams header without
// affecting existing conversations.

const STATUSES = [
  { value: "NEW",                  label: "New" },
  { value: "OPEN",                 label: "Open" },
  { value: "WAITING_FOR_CUSTOMER", label: "Waiting on customer" },
  { value: "WAITING_FOR_SUPPORT",  label: "Waiting on us" },
  { value: "RESOLVED",             label: "Resolved" },
  { value: "CLOSED",               label: "Closed" },
];

const CHIP: Record<string, string> = {
  NEW:                  "bg-indigo-500/15 text-indigo-400",
  OPEN:                 "bg-emerald-500/15 text-emerald-400",
  WAITING_FOR_CUSTOMER: "bg-zinc-700/50 text-zinc-400",
  WAITING_FOR_SUPPORT:  "bg-amber-500/15 text-amber-400",
  RESOLVED:             "bg-emerald-500/15 text-emerald-400",
  CLOSED:               "bg-zinc-700/50 text-zinc-500",
};

interface Guest {
  name: string; email: string; company: string | null;
  status: string; assigned_to: string | null;
  source: string | null; landing_page: string | null;
  created_at: string;
}

export default function SupportInquiryPanel({ channelId }: { channelId: string | null }) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [staff, setStaff] = useState<{ id: string; full_name: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!channelId) { setGuest(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_guests")
        .select("name, email, company, status, assigned_to, source, landing_page, created_at")
        .eq("channel_id", channelId).maybeSingle();
      if (!cancelled) { setGuest((data as Guest) ?? null); setErr(""); }
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  useEffect(() => {
    if (!guest) return;
    supabase.from("profiles").select("id, full_name")
      .eq("status", "active").order("full_name")
      .then(({ data }) => setStaff(data ?? []));
  }, [guest]);

  async function update(status?: string, assign?: string) {
    if (!channelId || busy) return;
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.rpc("support_set_status", {
        p_channel: channelId,
        p_status: status ?? null,
        p_assign: assign ?? null,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error("That change was not allowed.");
      const { data: fresh } = await supabase
        .from("support_guests")
        .select("name, email, company, status, assigned_to, source, landing_page, created_at")
        .eq("channel_id", channelId).maybeSingle();
      setGuest((fresh as Guest) ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  // Not a support conversation.
  if (!guest) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/40">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-zinc-900/60 transition">
        <div className="flex items-center gap-2.5 min-w-0">
          <Globe size={13} className="text-zinc-500 flex-shrink-0" />
          <span className="text-xs text-zinc-300 truncate">{guest.name}</span>
          {guest.company && <span className="text-[11px] text-zinc-600 truncate hidden sm:inline">{guest.company}</span>}
        </div>
        <span className={"text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 " + (CHIP[guest.status] ?? "")}>
          {STATUSES.find((s) => s.value === guest.status)?.label ?? guest.status}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3.5 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div><span className="text-zinc-600">Email</span><p className="text-zinc-300 truncate">{guest.email}</p></div>
            <div><span className="text-zinc-600">Company</span><p className="text-zinc-300 truncate">{guest.company || "-"}</p></div>
            <div><span className="text-zinc-600">Source</span><p className="text-zinc-300">{guest.source || "website"}</p></div>
            <div><span className="text-zinc-600">Started</span><p className="text-zinc-300">{new Date(guest.created_at).toLocaleDateString()}</p></div>
          </div>

          {err && <p role="alert" className="text-[11px] text-red-400">{err}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-600 block mb-1">Status</label>
              <select value={guest.status} disabled={busy}
                onChange={(e) => update(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500 disabled:opacity-50">
                {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 block mb-1">Assigned to</label>
              <select value={guest.assigned_to ?? ""} disabled={busy}
                onChange={(e) => update(undefined, e.target.value || undefined)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500 disabled:opacity-50">
                <option value="">Unassigned</option>
                {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name ?? "Teammate"}</option>))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => update("RESOLVED")} disabled={busy || guest.status === "RESOLVED"}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-emerald-600/40 text-emerald-400 text-[11px] hover:bg-emerald-500/10 disabled:opacity-40 transition">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Resolve
            </button>
            <button onClick={() => update("CLOSED")} disabled={busy || guest.status === "CLOSED"}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] hover:text-white disabled:opacity-40 transition">
              <XCircle size={11} /> Close
            </button>
          </div>

          <p className="text-[10px] text-zinc-600">
            Closing stops the visitor from sending further messages. Their history is kept.
          </p>
        </div>
      )}
    </div>
  );
}
