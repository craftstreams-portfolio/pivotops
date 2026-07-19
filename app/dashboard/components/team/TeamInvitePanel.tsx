"use client";

import { useState, useEffect } from "react";
import { isValidEmail } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import { X, Mail, Send, Copy, Check, Loader2, AlertCircle, Users } from "lucide-react";
import { seatCapForPlan, planLabel, isSeatExempt } from "@/lib/paddle/config";

const ROLES = [
  { value: "admin",     label: "Admin",     desc: "Full access - manage settings, billing, and all team members." },
  { value: "manager",   label: "Manager",   desc: "Oversee recruitment, onboarding, and team operations." },
  { value: "recruiter", label: "Recruiter", desc: "Manage candidates, interviews, and offers." },
  { value: "operator",  label: "Operator",  desc: "Day-to-day operations - clocking, tasks, and team chat." },
];


interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  position: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function TeamInvitePanel({
  open, onClose, tenantId, orgSize,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  orgSize: string;
}) {
  const [email,    setEmail]    = useState("");
  const [role,     setRole]     = useState("operator");
  const [position, setPosition] = useState("");
  const [members,  setMembers]  = useState<Member[]>([]);
  const [myRole,   setMyRole]   = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole,  setEditRole]  = useState("operator");
  const [editTitle, setEditTitle] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [memberErr, setMemberErr] = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");
  const [lastLink, setLastLink] = useState("");
  const [copied,   setCopied]   = useState(false);
  const [invites,  setInvites]  = useState<PendingInvite[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  // Seats come from the paid tier, read from the same table every feature gate
  // uses - so this counter and the server-side cap cannot drift apart.
  const [plan, setPlan] = useState<string>("free");
  useEffect(() => {
    if (!tenantId) return;
    supabase.from("subscriptions").select("plan, status").eq("tenant_id", tenantId).maybeSingle()
      .then(({ data }) => {
        if (data?.plan) {
          const live = data.status === "active" || data.status === "trialing";
          setPlan(live ? data.plan : "free");
          return;
        }
        supabase.from("tenants").select("plan").eq("id", tenantId).maybeSingle()
          .then(({ data: tn }) => setPlan(tn?.plan ?? "free"));
      });
  }, [tenantId]);

  const cap = isSeatExempt(tenantId) ? Infinity : seatCapForPlan(plan);

  useEffect(() => {
    if (!open || !tenantId) return;
    refreshCounts();
  }, [open, tenantId]);

  async function refreshCounts() {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    setMemberCount(count ?? 0);
    const { data } = await supabase.from("team_invites").select("id, email, role, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
    setInvites((data ?? []) as PendingInvite[]);

    const { data: mem } = await supabase
      .from("profiles").select("id, full_name, email, role, position")
      .eq("tenant_id", tenantId).order("full_name", { ascending: true });
    setMembers((mem ?? []) as Member[]);

    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const me = (mem ?? []).find((m: any) => m.id === auth.user!.id);
      setMyRole(me?.role ?? "");
    }
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditRole(m.role ?? "operator");
    setEditTitle(m.position ?? "");
    setMemberErr("");
  }

  async function saveMember(memberId: string) {
    setSavingMember(true); setMemberErr("");
    try {
      const res = await fetch("/api/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: editRole, position: editTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update teammate.");
      setEditingId(null);
      refreshCounts();
    } catch (err) {
      setMemberErr(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingMember(false);
    }
  }

  const pendingCount = invites.filter((i) => i.status === "pending").length;
  const seatsUsed = memberCount + pendingCount;
  const seatsLeft = cap === Infinity ? Infinity : Math.max(0, cap - seatsUsed);

  async function handleInvite() {
    if (!email.trim()) return;
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    setSending(true);
    setError("");
    setLastLink("");
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, position: position.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite.");
      setLastLink(data.inviteLink || "");
      setEmail("");
      setPosition("");
      refreshCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-white">Invite teammates</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {cap === Infinity ? memberCount + " members" : seatsUsed + " of " + cap + " seats used · " + planLabel(plan)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {seatsLeft === 0 ? (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                {planLabel(plan)} includes {cap} seat{cap === 1 ? "" : "s"}, all currently used or pending. Upgrade your plan in Settings to invite more teammates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Mail size={11} /> Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">
                  Job title <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Senior Recruiter, Regional Ops Lead"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500 transition"
                />
                <p className="text-[11px] text-zinc-600 mt-1.5">
                  Shown on their profile. Access is set by the role below.
                </p>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Role and access</label>
                <div className="space-y-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      className={"w-full text-left px-4 py-3 rounded-xl border transition " + (role === r.value ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700")}
                    >
                      <p className={"text-sm font-medium " + (role === r.value ? "text-emerald-400" : "text-white")}>{r.label}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleInvite}
                disabled={sending || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? "Sending..." : "Send invite"}
              </button>

              {lastLink && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                  <p className="text-xs text-zinc-500">Invite sent. You can also share this link directly:</p>
                  <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2">
                    <span className="text-xs text-zinc-300 truncate flex-1">{lastLink}</span>
                    <button onClick={copyLink} className="flex-shrink-0 text-zinc-400 hover:text-white transition">
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {members.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={13} className="text-zinc-500" />
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Team members</h3>
              </div>

              {memberErr && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
                  {memberErr}
                </div>
              )}

              <div className="space-y-2">
                {members.map((m) => {
                  const canEdit = myRole === "admin" || (myRole === "manager" && m.role !== "admin");
                  const isEditing = editingId === m.id;
                  return (
                    <div key={m.id} className="px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      {!isEditing ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate">{m.full_name || m.email}</p>
                            <p className="text-[10px] text-zinc-500">
                              <span className="capitalize">{m.role ?? "operator"}</span>
                              {m.position ? ` \u00B7 ${m.position}` : ""}
                            </p>
                          </div>
                          {canEdit && (
                            <button onClick={() => startEdit(m)}
                              className="flex-shrink-0 text-[10px] px-2 py-1 rounded-md border border-zinc-700
                                         text-zinc-400 hover:text-white hover:border-zinc-600 transition">
                              Edit
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-white truncate">{m.full_name || m.email}</p>
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2
                                       text-xs text-white outline-none focus:border-emerald-500">
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={60} placeholder="Job title (optional)"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2
                                       text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500" />
                          <div className="flex gap-2">
                            <button onClick={() => saveMember(m.id)} disabled={savingMember}
                              className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500
                                         text-white text-[11px] font-semibold disabled:opacity-40 transition">
                              {savingMember ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => { setEditingId(null); setMemberErr(""); }}
                              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[11px] transition">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-zinc-500" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pending invites</h3>
            </div>
            {invites.length === 0 ? (
              <p className="text-xs text-zinc-600">No invites sent yet.</p>
            ) : (
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{inv.email}</p>
                      <p className="text-[10px] text-zinc-500 capitalize">{inv.role}</p>
                    </div>
                    <span className={"text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 " + (inv.status === "accepted" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/50 text-zinc-400")}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}