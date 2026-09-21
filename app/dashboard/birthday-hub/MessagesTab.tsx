"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Send, Check, X as XIcon, Clock, AlertCircle, Ban } from "lucide-react";

// Every state change here goes through /api/birthday/messages. Nothing in this
// component writes to birthday_messages directly - the table has no client
// write policy, so a forged status transition is rejected by the database.

interface Msg {
  id: string;
  recipient_id: string;
  channel: string;
  subject: string | null;
  rendered_body: string;
  status: string;
  company_name_snapshot: string;
  created_by: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  suppression_reason: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Tpl { id: string; name: string; subject: string; is_system: boolean; tone: string | null; }

const STATUS_CHIP: Record<string, string> = {
  draft:            "bg-zinc-700/50 text-zinc-400",
  pending_approval: "bg-amber-500/15 text-amber-400",
  approved:         "bg-indigo-500/15 text-indigo-400",
  rejected:         "bg-red-500/15 text-red-400",
  scheduled:        "bg-indigo-500/15 text-indigo-400",
  sending:          "bg-indigo-500/15 text-indigo-400",
  sent:             "bg-emerald-500/15 text-emerald-400",
  failed:           "bg-red-500/15 text-red-400",
  cancelled:        "bg-zinc-700/50 text-zinc-500",
  suppressed:       "bg-zinc-700/50 text-zinc-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending approval",
  suppressed:       "Suppressed",
  sent:             "Sent",
};

export default function MessagesTab({
  me, names,
}: {
  me: { id: string; tenant_id: string; role: string };
  names: Record<string, string>;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const isApprover = ["admin", "manager"].includes(me.role);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from("birthday_messages")
        .select("id, recipient_id, channel, subject, rendered_body, status, company_name_snapshot, created_by, approved_by, rejection_reason, failure_reason, suppression_reason, sent_at, created_at")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("birthday_templates").select("id, name, subject, is_system, tone").order("is_system", { ascending: false }),
    ]);
    setMsgs((m ?? []) as Msg[]);
    setTpls((t ?? []) as Tpl[]);
    setLoading(false);
  }

  async function act(messageId: string, action: string, reason?: string) {
    setBusyId(messageId); setErr(""); setToast("");
    try {
      const res = await fetch("/api/birthday/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, messageId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not complete that.");
      if (data.status === "suppressed") {
        setToast("Not sent - this employee has opted out.");
      } else {
        setToast(action === "send" ? "Message sent." : action === "approve" ? "Approved." : action === "reject" ? "Rejected." : "Cancelled.");
      }
      setTimeout(() => setToast(""), 5000);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusyId(null); }
  }

  const pending  = msgs.filter((m) => m.status === "pending_approval");
  const ready    = msgs.filter((m) => m.status === "approved");
  const history  = msgs.filter((m) => !["pending_approval", "approved"].includes(m.status));

  if (loading) return <p className="text-sm text-zinc-500">Loading messages...</p>;

  return (
    <div className="space-y-6">
      {toast && <div role="status" className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{toast}</div>}
      {err && <div role="alert" className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{err}</div>}

      <Composer me={me} names={names} tpls={tpls} onDone={load} />

      {isApprover && (
        <section aria-labelledby="pending-h">
          <h2 id="pending-h" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock size={12} className="text-amber-400" /> Awaiting approval ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-xs text-zinc-600">Nothing waiting.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((m) => (
                <Card key={m.id} m={m} names={names}>
                  {m.created_by === me.id ? (
                    <p className="text-[10px] text-zinc-500 mt-2">
                      You wrote this - someone else needs to approve it.
                    </p>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => act(m.id, "approve")} disabled={busyId === m.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-40 transition">
                        {busyId === m.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
                      </button>
                      <button onClick={() => { const r = window.prompt("Reason for rejecting? (optional)"); if (r !== null) act(m.id, "reject", r); }}
                        disabled={busyId === m.id}
                        className="px-3 py-1.5 rounded-lg border border-red-600/40 text-red-400 text-[11px] hover:bg-red-500/10 disabled:opacity-40 transition">
                        <XIcon size={11} />
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="ready-h">
        <h2 id="ready-h" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Ready to send ({ready.length})
        </h2>
        {ready.length === 0 ? (
          <p className="text-xs text-zinc-600">Nothing approved and waiting.</p>
        ) : (
          <div className="space-y-2">
            {ready.map((m) => (
              <Card key={m.id} m={m} names={names}>
                {isApprover && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => act(m.id, "send")} disabled={busyId === m.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-40 transition">
                      {busyId === m.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      {busyId === m.id ? "Sending..." : "Send now"}
                    </button>
                    <button onClick={() => act(m.id, "cancel")} disabled={busyId === m.id}
                      className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] hover:text-white disabled:opacity-40 transition">
                      <Ban size={11} />
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-xs text-zinc-600">No messages yet.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{names[m.recipient_id] ?? "Employee"}</p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {m.channel === "email" ? "Email" : "In-app"}
                    {m.sent_at ? " \u00B7 " + new Date(m.sent_at).toLocaleDateString() : ""}
                    {m.failure_reason ? " \u00B7 " + m.failure_reason : ""}
                    {m.suppression_reason ? " \u00B7 opted out" : ""}
                    {m.rejection_reason ? " \u00B7 " + m.rejection_reason : ""}
                  </p>
                </div>
                <span className={"text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 " + (STATUS_CHIP[m.status] ?? "bg-zinc-700/50 text-zinc-400")}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ m, names, children }: { m: Msg; names: Record<string, string>; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{names[m.recipient_id] ?? "Employee"}</p>
          <p className="text-[10px] text-zinc-500">{m.channel === "email" ? "Email" : "In-app"} \u00B7 {m.company_name_snapshot}</p>
        </div>
        <span className={"text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 " + (STATUS_CHIP[m.status] ?? "")}>
          {STATUS_LABEL[m.status] ?? m.status}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2 whitespace-pre-wrap line-clamp-6">{m.rendered_body}</p>
      {children}
    </div>
  );
}

// ── COMPOSER ────────────────────────────────────────────────────────────────
function Composer({ me, names, tpls, onDone }: {
  me: { id: string; tenant_id: string; role: string };
  names: Record<string, string>;
  tpls: Tpl[];
  onDone: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [template, setTemplate] = useState("");
  const [channel, setChannel] = useState("in_app");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!template && tpls.length) setTemplate(tpls[0].id);
  }, [tpls]);

  const options = Object.entries(names).filter(([id]) => id !== me.id);

  async function create() {
    if (!recipient || !template) { setErr("Choose an employee and a template."); return; }
    setBusy(true); setErr(""); setOk("");
    try {
      const res = await fetch("/api/birthday/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", recipientId: recipient, templateId: template, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the message.");
      setOk(data.status === "pending_approval" ? "Created and sent for approval." : "Created and ready to send.");
      setRecipient("");
      setTimeout(() => setOk(""), 5000);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">New message</h2>

      {ok && <div role="status" className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">{ok}</div>}
      {err && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" /> <span>{err}</span>
        </div>
      )}

      <div>
        <label htmlFor="rcpt" className="text-[11px] text-zinc-500 block mb-1">Employee</label>
        <select id="rcpt" value={recipient} onChange={(e) => setRecipient(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-emerald-500">
          <option value="">Choose...</option>
          {options.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
        </select>
        <p className="text-[10px] text-zinc-600 mt-1">Only employees whose birthday is visible to you appear here.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="tpl" className="text-[11px] text-zinc-500 block mb-1">Template</label>
          <select id="tpl" value={template} onChange={(e) => setTemplate(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-emerald-500">
            {tpls.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="ch" className="text-[11px] text-zinc-500 block mb-1">Channel</label>
          <select id="ch" value={channel} onChange={(e) => setChannel(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-emerald-500">
            <option value="in_app">In-app notification</option>
            <option value="email">Email</option>
          </select>
        </div>
      </div>

      <button onClick={create} disabled={busy || !recipient}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition">
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? "Creating..." : "Create message"}
      </button>
    </div>
  );
}
