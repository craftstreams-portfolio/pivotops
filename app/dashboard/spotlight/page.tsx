"use client";

import { useEffect, useState, useRef } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { FeatureGate } from "@/app/components/FeatureGate";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  Star, Pin, Plus, X, Upload, Heart,
  CheckCircle2, AlertCircle, Search,
  Sparkles, Loader2, Brain, Trophy,
  ChevronDown, ThumbsUp, ThumbsDown,
  Clock, ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface SpotlightPost {
  id:                   string;
  tenant_id:            string;
  user_id:              string | null;
  reason:               string;
  created_by:           string;
  created_at:           string;
  expires_at:           string | null;
  category:             string | null;
  image_url:            string | null;
  pinned:               boolean;
  reactions:            Record<string, string[]>;
  metadata:             any;
  approval_status:      "pending" | "approved" | "rejected";
  approved_by:          string | null;
  approved_at:          string | null;
  rejection_reason:     string | null;
  analysis:             string | null;
  is_spotlight_of_month:boolean;
  reveal_at:            string | null;
  spotlight_month:      string | null;
}

interface Reaction {
  id:        string;
  post_id:   string;
  user_id:   string;
  user_name: string | null;
  reaction:  string;
}

interface Profile {
  id:        string;
  full_name: string | null;
  email:     string | null;
  role?:     string | null;
}

const CATEGORIES = [
  "All",
  "Employee Recognition",
  "Recruiter Win",
  "Onboarding Highlight",
  "Placement Win",
  "Operational Achievement",
  "Team Milestone",
  "Compliance Win",
];

const REACTIONS = ["👏","🔥","🏆","❤️","💯","🚀"];

const CATEGORY_COLORS: Record<string, string> = {
  "Employee Recognition":    "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "Recruiter Win":           "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Onboarding Highlight":    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Placement Win":           "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Operational Achievement": "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "Team Milestone":          "bg-teal-500/15 text-teal-400 border-teal-500/20",
  "Compliance Win":          "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function getInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
    : p[0][0].toUpperCase();
}

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
interface Toast { id: string; type: "success" | "error"; message: string; }
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm shadow-lg
          ${t.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/15 border-red-500/30 text-red-300"}`}>
          {t.type === "success"
            ? <CheckCircle2 size={15} className="flex-shrink-0" />
            : <AlertCircle  size={15} className="flex-shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// APPROVAL MODAL — manager approves/rejects
// ─────────────────────────────────────────
function ApprovalModal({
  post, currentUser, onClose, onDone,
}: {
  post:        SpotlightPost;
  currentUser: Profile;
  onClose:     () => void;
  onDone:      (action: "approve" | "reject") => void;
}) {
  const [analysis,         setAnalysis]         = useState("");
  const [rejectionReason,  setRejectionReason]  = useState("");
  const [action,           setAction]           = useState<"approve" | "reject" | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState("");

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  const monthLabel = nextMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  const handleSubmit = async () => {
    if (!action) return;
    if (action === "approve" && !analysis.trim()) {
      setError("Please provide an analysis explaining why this employee is being spotlighted.");
      return;
    }
    if (action === "reject" && !rejectionReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/spotlight/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotlightId:     post.id,
          action,
          managerId:       currentUser.id,
          managerName:     currentUser.full_name ?? currentUser.email,
          analysis:        analysis.trim() || undefined,
          rejectionReason: rejectionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      onDone(action);
      onClose();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-white">Review Spotlight Nomination</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Post summary */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300
                            flex items-center justify-center text-sm font-bold flex-shrink-0">
              {getInitials(post.created_by)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{post.created_by}</p>
              {post.category && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border
                  ${CATEGORY_COLORS[post.category] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                  {post.category}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{post.reason}</p>
          {post.image_url && (
            <img src={post.image_url} alt="spotlight" className="w-full h-32 object-cover rounded-lg" />
          )}
        </div>

        {/* Action choice */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Your decision</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAction("approve")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition
                ${action === "approve"
                  ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                  : "border-zinc-700 text-zinc-500 hover:border-emerald-500/30 hover:text-emerald-400"}`}
            >
              <ThumbsUp size={14} /> Approve for {monthLabel}
            </button>
            <button
              onClick={() => setAction("reject")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition
                ${action === "reject"
                  ? "bg-red-600/20 border-red-500/40 text-red-400"
                  : "border-zinc-700 text-zinc-500 hover:border-red-500/30 hover:text-red-400"}`}
            >
              <ThumbsDown size={14} /> Reject
            </button>
          </div>
        </div>

        {/* Analysis (approve) */}
        {action === "approve" && (
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">
              Detailed analysis — why this employee deserves Spotlight of the Month *
            </label>
            <textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              placeholder={`e.g. ${post.created_by} consistently exceeded targets this quarter, closed 5 high-value placements, and mentored 2 new recruits. Their dedication to compliance and team culture makes them an exemplary choice for Spotlight of the Month...`}
              rows={5}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                         text-sm text-white placeholder-zinc-600 outline-none
                         focus:border-zinc-600 transition resize-none leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <Brain size={12} className="text-amber-400 flex-shrink-0" />
              <p className="text-[11px] text-amber-300/70">
                This analysis will be posted to Teams Media and displayed on all employee dashboards on 1st {monthLabel} at 12:00 AM EST.
              </p>
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {action === "reject" && (
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Reason for rejection *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Another nomination was selected, insufficient documentation..."
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                         text-sm text-white placeholder-zinc-600 outline-none
                         focus:border-zinc-600 transition resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !action}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                        text-sm font-semibold disabled:opacity-40 transition
              ${action === "approve"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : action === "reject"
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-zinc-800 text-zinc-500"}`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> :
              action === "approve" ? <CheckCircle2 size={14} /> : <X size={14} />
            }
            {saving ? "Processing..." :
              action === "approve" ? "Confirm Approval" :
              action === "reject"  ? "Confirm Rejection" : "Select action above"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// SPOTLIGHT CARD
// ─────────────────────────────────────────
function SpotlightCard({
  post, currentUser, reactions, onReact, onPin, onReview, tenantId,
}: {
  post:        SpotlightPost;
  currentUser: Profile | null;
  reactions:   Reaction[];
  onReact:     (postId: string, emoji: string) => void;
  onPin:       (postId: string, pinned: boolean) => void;
  onReview:    (post: SpotlightPost) => void;
  tenantId:    string;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const postReactions  = reactions.filter((r) => r.post_id === post.id);
  const reactionGroups: Record<string, number> = {};
  postReactions.forEach((r) => { reactionGroups[r.reaction] = (reactionGroups[r.reaction] ?? 0) + 1; });
  const userReacted = (emoji: string) => postReactions.some((r) => r.user_id === currentUser?.id && r.reaction === emoji);
  const catColor    = CATEGORY_COLORS[post.category ?? ""] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
  const isManager   = currentUser?.role === "admin" || currentUser?.role === "manager";

  const approvalBadge = {
    pending:  "bg-amber-500/15 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  }[post.approval_status];

  return (
    <div className={`rounded-2xl border bg-zinc-900 overflow-hidden transition hover:border-zinc-700
      ${post.is_spotlight_of_month ? "border-amber-500/30" :
        post.pinned                ? "border-amber-500/20" : "border-zinc-800"}`}>

      {/* Spotlight of month banner */}
      {post.is_spotlight_of_month && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-b border-amber-500/20">
          <Trophy size={13} className="text-amber-400" />
          <span className="text-xs text-amber-400 font-semibold">
            Spotlight of the Month
            {post.reveal_at && (
              <span className="text-amber-400/60 font-normal ml-1">
                · Live {new Date(post.reveal_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        </div>
      )}

      {post.image_url && (
        <img src={post.image_url} alt="spotlight" className="w-full h-48 object-cover" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300
                            flex items-center justify-center font-bold text-sm flex-shrink-0">
              {getInitials(post.created_by)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{post.created_by}</p>
              <p className="text-[11px] text-zinc-500">{timeAgo(post.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {post.category && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catColor}`}>
                {post.category}
              </span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${approvalBadge}`}>
              {post.approval_status === "pending"  ? "⏳ Pending Review" :
               post.approval_status === "approved" ? "✅ Approved"       : "❌ Rejected"}
            </span>
            {currentUser && (
              <button onClick={() => onPin(post.id, !post.pinned)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition
                  ${post.pinned ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-600 hover:text-amber-400"}`}>
                <Pin size={13} />
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-white/90 leading-relaxed">{post.reason}</p>

        {/* Manager analysis */}
        {post.analysis && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <p className="text-[10px] text-amber-400 font-semibold mb-1 flex items-center gap-1">
              <Brain size={10} /> Manager Analysis
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">{post.analysis}</p>
            {post.approved_by && (
              <p className="text-[10px] text-zinc-600 mt-1">
                — {post.approved_by} · {post.approved_at ? new Date(post.approved_at).toLocaleDateString() : ""}
              </p>
            )}
          </div>
        )}

        {/* Xavier Performance Breakdown */}
        {post.metadata?.performance && (
          <div className="mt-3 px-3 py-3 rounded-xl bg-teal-500/5 border border-teal-500/15">
            <p className="text-[10px] text-teal-400 font-semibold mb-2 flex items-center gap-1">
              <Brain size={10} /> Xavier Performance Breakdown
              <span className="text-zinc-600 font-normal ml-1">· {post.metadata.performance.month}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Attendance", m: post.metadata.performance.attendance?.days_present, unit: " days" },
                { label: "Hours worked", m: post.metadata.performance.attendance?.hours_worked, unit: "h" },
                { label: "On-time rate", m: post.metadata.performance.punctuality?.on_time_rate, unit: "%" },
                { label: "Late arrivals", m: post.metadata.performance.punctuality?.late_count, unit: "" },
                { label: "Closing rate", m: post.metadata.performance.recruitment?.closing_rate, unit: "%" },
                { label: "Hires", m: post.metadata.performance.recruitment?.hires, unit: "" },
                { label: "Tasks completed", m: post.metadata.performance.productivity?.tasks_completed, unit: "" },
                { label: "Avg response time", m: post.metadata.performance.response_time?.avg_minutes, unit: "m" },
              ].map(({ label, m, unit }) => (
                <div key={label} className="px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</p>
                  {m?.available ? (
                    <p className="text-sm text-white font-semibold">{m.value}{unit}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-600 italic mt-0.5">Not tracked</p>
                  )}
                  {m?.available && m.detail && <p className="text-[9px] text-zinc-600 mt-0.5">{m.detail}</p>}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-zinc-600 mt-2 italic">Auto-generated from clocking, recruitment, and task data. Metrics marked "not tracked" lack sufficient data.</p>
          </div>
        )}

        {/* Rejection reason */}
        {post.approval_status === "rejected" && post.rejection_reason && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/15">
            <p className="text-[10px] text-red-400 font-semibold mb-0.5">Not selected</p>
            <p className="text-xs text-zinc-500">{post.rejection_reason}</p>
          </div>
        )}

        <div className="h-px bg-zinc-800 my-4" />

        {/* Bottom row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Reaction counts */}
          {Object.entries(reactionGroups).map(([emoji, count]) => (
            <button key={emoji} onClick={() => onReact(post.id, emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition
                ${userReacted(emoji)
                  ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
              {emoji} <span className="text-[10px]">{count}</span>
            </button>
          ))}

          {/* Add reaction */}
          <div className="relative">
            <button onClick={() => setShowReactions((o) => !o)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border
                         border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition">
              <Heart size={11} /> React
            </button>
            {showReactions && (
              <div className="absolute bottom-9 left-0 flex gap-1 bg-zinc-900 border border-zinc-800
                              rounded-2xl p-2 shadow-xl z-20">
                {REACTIONS.map((emoji) => (
                  <button key={emoji}
                    onClick={() => { onReact(post.id, emoji); setShowReactions(false); }}
                    className="w-9 h-9 rounded-xl hover:bg-zinc-800 flex items-center justify-center text-lg transition">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manager review button */}
          {isManager && post.approval_status === "pending" && (
            <button onClick={() => onReview(post)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25
                         text-xs text-amber-400 font-semibold transition">
              <ShieldCheck size={12} /> Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// COMPOSER MODAL
// ─────────────────────────────────────────
function ComposerModal({
  tenantId, currentUser, onClose, onCreated,
}: {
  tenantId:    string;
  currentUser: Profile | null;
  onClose:     () => void;
  onCreated:   () => void;
}) {
  const [reason,       setReason]       = useState("");
  const [category,     setCategory]     = useState(CATEGORIES[1]);
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!reason.trim()) { setError("Recognition text is required"); return; }
    setSaving(true); setError("");

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext  = imageFile.name.split(".").pop();
        const path = `spotlight/${tenantId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-media").upload(path, imageFile);
        if (upErr) throw new Error(upErr.message);
        const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("spotlights").insert({
        tenant_id:       tenantId,
        reason:          reason.trim(),
        category:        category !== "All" ? category : null,
        created_by:      currentUser?.full_name ?? currentUser?.email ?? "Unknown",
        user_id:         currentUser?.id ?? null,
        image_url:       imageUrl,
        pinned:          false,
        reactions:       {},
        approval_status: "pending",
        created_at:      new Date().toISOString(),
      });

      if (error) throw new Error(error.message);
      onCreated();
      onClose();
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-white">Nominate for Spotlight</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 py-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
          <p className="text-[11px] text-blue-300">
            Nominations are reviewed by a manager before being published. Approved nominations
            become Spotlight of the Month and display on all dashboards on the 1st of the following month.
          </p>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                       text-sm text-white outline-none focus:border-zinc-600 cursor-pointer">
            {CATEGORIES.filter((c) => c !== "All").map((c) => (
              <option key={c} value={c} className="bg-zinc-900">{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Recognition *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Why does this person deserve to be spotlighted? Be specific about their achievements..."
            rows={4}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                       text-sm text-white placeholder-zinc-600 outline-none
                       focus:border-zinc-600 transition resize-none leading-relaxed" />
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Attach Image (optional)</label>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
              <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60
                           flex items-center justify-center text-white hover:bg-black/80">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed
                         border-zinc-700 hover:border-zinc-600 cursor-pointer transition">
              <Upload size={15} className="text-zinc-500" />
              <span className="text-sm text-zinc-500">Click to upload image</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold
                       disabled:opacity-40 transition">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
            {saving ? "Submitting..." : "Submit Nomination"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
function SpotlightPageInner() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [posts,         setPosts]         = useState<SpotlightPost[]>([]);
  const [reactions,     setReactions]     = useState<Reaction[]>([]);
  const [currentUser,   setCurrentUser]   = useState<Profile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showCompose,   setShowCompose]   = useState(false);
  const [reviewingPost, setReviewingPost] = useState<SpotlightPost | null>(null);
  const [search,        setSearch]        = useState("");
  const [category,      setCategory]      = useState("All");
  const [statusFilter,  setStatusFilter]  = useState<"all"|"pending"|"approved"|"rejected">("all");
  const [toasts,        setToasts]        = useState<Toast[]>([]);

  const showToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  };

  useEffect(() => {
    getCurrentProfile().then((p) => { if (p) setCurrentUser(p); });
  }, []);

  const load = async () => {
    if (tenantLoading) return;
    const { data: postData } = await supabase
      .from("spotlights").select("*")
      .eq("tenant_id", tenantId)
      .order("is_spotlight_of_month", { ascending: false })
      .order("pinned",                { ascending: false })
      .order("created_at",            { ascending: false });

    const { data: reactionData } = await supabase
      .from("spotlight_reactions").select("*").eq("tenant_id", tenantId);

    setPosts((postData ?? []) as SpotlightPost[]);
    setReactions((reactionData ?? []) as Reaction[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId, tenantLoading]);

  useEffect(() => {
    if (tenantLoading) return;
    const ch = supabase.channel("spotlight-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "spotlights" },         () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "spotlight_reactions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, tenantLoading]);

  const handleReact = async (postId: string, emoji: string) => {
    if (!currentUser) return;
    const existing = reactions.find(
      (r) => r.post_id === postId && r.user_id === currentUser.id && r.reaction === emoji
    );
    if (existing) {
      await supabase.from("spotlight_reactions").delete().eq("id", existing.id);
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
    } else {
      const { data } = await supabase.from("spotlight_reactions")
        .insert({ post_id: postId, user_id: currentUser.id,
                  user_name: currentUser.full_name ?? currentUser.email,
                  reaction: emoji, tenant_id: tenantId })
        .select().single();
      if (data) setReactions((prev) => [...prev, data as Reaction]);
    }
  };

  const handlePin = async (postId: string, pinned: boolean) => {
    await supabase.from("spotlights").update({ pinned }).eq("id", postId);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, pinned } : p));
    showToast("success", pinned ? "Post pinned" : "Post unpinned");
  };

  const visible = posts.filter((p) => {
    const matchSearch  = !search ||
      p.reason.toLowerCase().includes(search.toLowerCase()) ||
      p.created_by.toLowerCase().includes(search.toLowerCase());
    const matchCat    = category === "All" || p.category === category;
    const matchStatus = statusFilter === "all" || p.approval_status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const pendingCount  = posts.filter((p) => p.approval_status === "pending").length;
  const approvedCount = posts.filter((p) => p.approval_status === "approved").length;
  const isManager     = currentUser?.role === "admin" || currentUser?.role === "manager";

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading spotlight...
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} />
      {showCompose && (
        <ComposerModal
          tenantId={tenantId} currentUser={currentUser}
          onClose={() => setShowCompose(false)}
          onCreated={() => { load(); showToast("success", "Nomination submitted! Awaiting manager review."); }}
        />
      )}
      {reviewingPost && currentUser && (
        <ApprovalModal
          post={reviewingPost} currentUser={currentUser}
          onClose={() => setReviewingPost(null)}
          onDone={(action) => {
            load();
            showToast("success",
              action === "approve"
                ? `Approved! Will go live on 1st of next month at 12:00 AM EST and post to Teams Media.`
                : "Nomination rejected."
            );
          }}
        />
      )}

      <div className="p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles size={22} className="text-amber-400" /> Spotlight
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Recognise achievements · approved nominations become Spotlight of the Month
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isManager && pendingCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/25
                               bg-amber-500/10 text-xs text-amber-400">
                <Clock size={12} /> {pendingCount} pending review
              </span>
            )}
            <button onClick={() => setShowCompose(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500
                         hover:bg-amber-400 text-black text-sm font-semibold transition">
              <Plus size={15} /> Nominate
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total",    value: posts.length,              color: "text-white"       },
            { label: "Approved", value: approvedCount,             color: "text-emerald-400" },
            { label: "Pending",  value: pendingCount,              color: "text-amber-400"   },
            { label: "Reactions",value: reactions.length,          color: "text-indigo-400"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <Search size={14} className="text-zinc-600 flex-shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search spotlights..."
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-400"><X size={14} /></button>}
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer">
            {CATEGORIES.map((c) => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer">
            <option value="all"     className="bg-zinc-900">All Status</option>
            <option value="pending" className="bg-zinc-900">⏳ Pending</option>
            <option value="approved"className="bg-zinc-900">✅ Approved</option>
            <option value="rejected"className="bg-zinc-900">❌ Rejected</option>
          </select>
        </div>

        {/* Posts */}
        {visible.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">
            {search || category !== "All" ? "No spotlights match your search." : "No nominations yet. Be the first to nominate a teammate!"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((post) => (
              <SpotlightCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                reactions={reactions}
                onReact={handleReact}
                onPin={handlePin}
                onReview={setReviewingPost}
                tenantId={tenantId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
export default function SpotlightPage() {
  const { tenantId } = useTenant();
  return (
    <FeatureGate tenantId={tenantId} feature="spotlight" title="Spotlight">
      <SpotlightPageInner />
    </FeatureGate>
  );
}