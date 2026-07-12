"use client";
import { safeGetUserMedia } from "@/lib/media/safeGetUserMedia";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import {
  getCurrentProfile, getAllProfiles, type Profile,
} from "@/lib/profile/profile.service";
import {
  getChannels, getMessages, createChannel,
  sendTextMessage, uploadAndSendFile,
  uploadAndSendVoice, retractMessage,
  toggleReaction, subscribeToChannel,
  type Message, type Channel,
} from "@/lib/chat/chat.service";
import { useMentionInput }           from "@/lib/mentions/mention.hooks";
import { MentionInput, MentionText } from "@/lib/mentions/MentionInput";
import { NotificationBell }          from "@/lib/mentions/NotificationBell";
import XavierAvatar                  from "@/app/dashboard/components/team/XavierAvatar";
import ReportAIContent               from "@/app/dashboard/components/ai/ReportAIContent";
import {
  setUserPresence, getTenantPresence, subscribeToPresence,
  setOffline, type PresenceState,
} from "@/lib/teams/presence.service";
import {
  getGroupedQueue, resolveQueueItem, resolveCategory,
  subscribeToQueue, type QueueItem,
} from "@/lib/teams/queue.engine";
import {
  STATUS_META, type UserStatus, type QueueCategory,
} from "@/lib/teams/status.engine";
import {
  Send, Paperclip, Mic, Smile, Reply, Trash2,
  Plus, Hash, X, Play, Pause, Download,
  StopCircle, Search, Pin, MoreHorizontal,
  CheckCheck, Loader2, ChevronDown,
  Inbox, AtSign, Users, CheckCircle2,
  Bell, MessageSquare, ClipboardList,
  ShieldAlert, Brain, ExternalLink,
  Copy, Building2, Globe, Phone, Mail,
  Calendar, ArrowLeft, Briefcase, Zap,
} from "lucide-react";

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const EMOJI_LIST = [
  "😀","😄","❤️","😍","😊","😎","😂","🎉",
  "🔥","✅","❌","🚀","💯","🎯","👀","🙌",
  "👏","🙏","💪","⚡","🎊","💡","📌","😅",
];
const MEMES = [
  { label: "This is fine 🔥", content: "This is fine 🔥" },
  { label: "Deal with it 😎", content: "Deal with it 😎" },
  { label: "Stonks 📈",       content: "Stonks 📈"       },
  { label: "GG 🏆",           content: "GG 🏆"           },
  { label: "Ship it 🚀",      content: "Ship it 🚀"      },
  { label: "Big brain 🧠",    content: "Big brain 🧠"    },
];
const QUEUE_SECTIONS: {
  key: QueueCategory; label: string;
  icon: React.ElementType; color: string;
}[] = [
  { key: "escalations",   label: "Critical",     icon: ShieldAlert,   color: "text-red-400"    },
  { key: "mentions",      label: "Mentions",      icon: AtSign,        color: "text-indigo-400" },
  { key: "approvals",     label: "Approvals",     icon: ClipboardList, color: "text-amber-400"  },
  { key: "conversations", label: "Conversations", icon: MessageSquare, color: "text-zinc-400"   },
  { key: "alerts",        label: "Alerts",        icon: Bell,          color: "text-orange-400" },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getInitials(name: string | null, email: string | null) {  if (name) {
    const p = name.trim().split(" ");
    return p.length >= 2
      ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
      : p[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}
function formatTime(iso: string) {  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
function formatDuration(s: number) {  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function formatRelative(iso: string) {  const d = Date.now() - new Date(iso).getTime(), m = Math.floor(d / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
function groupByDate(msgs: Message[]) {  const g: { date: string; messages: Message[] }[] = [];
  for (const m of msgs) {
    const date = formatDate(m.created_at);
    const last = g[g.length - 1];
    if (last?.date === date) last.messages.push(m);
    else g.push({ date, messages: [m] });
  }
  return g;
}

// ─────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────
function Avatar({
  profile, size = "md", status,
}: {
  profile:  Profile | null;
  size?:    "xs" | "sm" | "md" | "lg";
  status?:  UserStatus | null;
}) {  const sz = size === "xs" ? "w-6 h-6 text-[9px]"
           : size === "sm" ? "w-8 h-8 text-xs"
           : size === "lg" ? "w-11 h-11 text-base"
                           : "w-9 h-9 text-sm";
  const dotColor = status ? STATUS_META[status]?.dot : null;
  return (
    <div className="relative flex-shrink-0">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt=""
            className={`${sz} rounded-full object-cover`} />
        : <div className={`${sz} rounded-full bg-indigo-500/20 text-indigo-300
                           flex items-center justify-center font-semibold`}>
            {getInitials(profile?.full_name ?? null, profile?.email ?? null)}
          </div>
      }
      {dotColor && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full
                          border-2 border-[#0a0a12] ${dotColor}`} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// STATUS SWITCHER (reusable)
// ─────────────────────────────────────────
function StatusSwitcher({
  current, onChange,
}: {
  current:  UserStatus;
  onChange: (s: UserStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[current];
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition w-full">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
        <span className={`text-xs font-medium ${meta.color} flex-1 text-left`}>{meta.label}</span>
        <ChevronDown size={11} className="text-zinc-600" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 bg-zinc-900 border border-zinc-700
                        rounded-xl shadow-2xl overflow-hidden z-50">
          {(Object.keys(STATUS_META) as UserStatus[]).map((s) => {
            const m = STATUS_META[s];
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-800
                             transition text-left ${current === s ? "bg-zinc-800/50" : ""}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${m.dot}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${m.color}`}>{m.label}</p>
                  <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">{m.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// PROFILE VIEW PANEL
// ─────────────────────────────────────────
function ProfileViewPanel({
  profile, isOwnProfile, currentStatus, onClose, onDM, onStatusChange,
}: {
  profile:       Profile;
  isOwnProfile:  boolean;
  currentStatus: UserStatus;
  onClose:       () => void;
  onDM:          (p: Profile) => void;
  onStatusChange:(s: UserStatus) => void;
}) {
  const meta = STATUS_META[currentStatus];

  const details: { icon: React.ElementType; label: string; value: string | null | undefined }[] = [
    { icon: Briefcase,  label: "Position",   value: profile.position   },
    { icon: Building2,  label: "Department", value: profile.department  },
    { icon: Globe,      label: "Location",   value: profile.location    },
    { icon: Phone,      label: "Phone",      value: profile.phone       },
    { icon: Mail,       label: "Email",      value: profile.email       },
    { icon: Calendar,   label: "Joined",     value: profile.date_joined
        ? new Date(profile.date_joined).toLocaleDateString([], { month: "long", year: "numeric" })
        : null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-80 h-full bg-[#0a0a14] border-l border-zinc-800
                      overflow-y-auto shadow-2xl flex flex-col">

        {/* Hero gradient */}
        <div className="relative h-24 bg-gradient-to-br from-indigo-900/50 via-purple-900/30 to-zinc-900 flex-shrink-0">
          <button onClick={onClose}
            className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-black/40
                       hover:bg-black/60 flex items-center justify-center transition">
            <ArrowLeft size={15} className="text-white" />
          </button>
        </div>

        <div className="px-5 pb-6 flex-1">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-[#0a0a14] overflow-hidden
                              bg-indigo-500/30 flex items-center justify-center">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt=""
                      className="w-full h-full object-cover" />
                  : <span className="text-xl font-bold text-indigo-200">
                      {getInitials(profile.full_name, profile.email)}
                    </span>
                }
              </div>
              <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full
                                border-2 border-[#0a0a14] ${meta.dot}`} />
            </div>

            {!isOwnProfile && (
              <button onClick={() => onDM(profile)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600
                           hover:bg-indigo-500 text-white text-xs font-semibold transition">
                <MessageSquare size={13} /> Message
              </button>
            )}
          </div>

          {/* Name */}
          <h2 className="text-lg font-bold text-white leading-tight">
            {profile.full_name ?? profile.email}
          </h2>
          {profile.position && (
            <p className="text-xs text-zinc-400 mt-0.5">{profile.position}</p>
          )}

          {/* Status */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            <span className={`text-xs ${meta.color}`}>{meta.label}</span>
          </div>

          {/* Status switcher — own profile only */}
          {isOwnProfile && (
            <div className="mt-3 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 pt-2.5 pb-1">
                Set status
              </p>
              <StatusSwitcher current={currentStatus} onChange={onStatusChange} />
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-zinc-800 my-4" />

          {/* Detail rows */}
          <div className="space-y-3">
            {details.filter(({ value }) => value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center
                                justify-center flex-shrink-0">
                  <Icon size={14} className="text-zinc-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
                  <p className="text-xs text-white font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Work mode badge */}
          {profile.work_mode && (
            <div className="mt-4">
              <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize
                ${profile.work_mode === "remote"
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                  : profile.work_mode === "hybrid"
                    ? "bg-purple-500/15 text-purple-400 border-purple-500/20"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"}`}>
                {profile.work_mode}
              </span>
            </div>
          )}

          {/* Role badge */}
          {profile.role && (
            <div className="mt-2">
              <span className="text-[11px] px-2.5 py-1 rounded-full border
                               bg-zinc-800 text-zinc-400 border-zinc-700 capitalize">
                {profile.role}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// CANDIDATE CARD
// Rich system message with Proceed/Decline
// ─────────────────────────────────────────
function CandidateCard({
  message, currentUser, tenantId, onActioned,
}: {
  message:     Message;
  currentUser: Profile | null;
  tenantId:    string;
  onActioned:  () => void;
}) {
  const meta    = message.meta as any;
  const isCard  = meta?.type === "candidate_card";
  const content = message.content ?? "";

  const [acting,      setActing]      = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [completed,   setCompleted]   = useState<string[]>(
    Array.isArray(meta?.completed_actions) ? meta.completed_actions
    : meta?.actioned ? [meta.action] : []
  );
  const [showDecline, setShowDecline] = useState(false);
  // Terminal actions close the whole card; others can stack independently
  const isTerminal = completed.includes("proceed_onboarding") || completed.includes("decline_candidate");
  const [reason,      setReason]      = useState("");
  const [copied,      setCopied]      = useState(false);

  const score     = meta?.score ?? 0;
  const scoreCls  = score >= 80 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
  const scoreBar  = score >= 80 ? "bg-emerald-500"   : score >= 70 ? "bg-amber-500"   : "bg-red-500";

  const handleAction = async (action: "schedule_interview" | "send_offer" | "proceed_onboarding" | "decline_candidate") => {
    if (!currentUser || acting) return;
    if (completed.includes(action)) return; // already done — idempotent guard
    setActing(action);
    try {
      const res = await fetch("/api/recruitment/candidate-action", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          candidateId:   meta.candidate_id,
          tenantId,
          actorId:       currentUser.id,
          actorName:     currentUser.full_name ?? currentUser.email ?? "Recruiter",
          messageId:     message.id,
          declineReason: reason.trim() || undefined,
          completedActions: completed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || ("Request failed: " + res.status));
      setCompleted((prev) => prev.includes(action) ? prev : [...prev, action]);
      setShowDecline(false);
      onActioned();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Candidate action failed:", msg);
      setActionError(msg);
      setTimeout(() => setActionError(""), 5000);
    } finally {
      setActing(null);
    }
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse markdown bold
  const renderLine = (line: string, i: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-xs text-zinc-300 leading-relaxed">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
      </p>
    );
  };

  return (
    <div className="flex gap-3 px-3 py-2.5 group">
      {/* Xavier AI avatar */}
      <XavierAvatar size={36} expression="friendly" showStatus={false} />

      <div className="flex-1 min-w-0 max-w-xl">
        {/* Sender + time */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-semibold text-indigo-400">Xavier AI</span>
          <span className="text-[10px] text-zinc-600">{formatTime(message.created_at)}</span>
          <ReportAIContent
            surface="xavier_message"
            refId={message.id}
            content={typeof message.content === "string" ? message.content : JSON.stringify(message.content)}
            className="ml-auto opacity-0 group-hover:opacity-100 transition"
          />
        </div>

        {/* Card */}
        <div className={`rounded-2xl border overflow-hidden
          ${isCard
            ? "border-indigo-500/25 bg-[#0d0d1f]"
            : "border-zinc-800 bg-zinc-900/60"}`}>

          {isCard ? (
            <>
              {/* Accent bar */}
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

              <div className="p-4 space-y-4">
                {/* Identity + score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white">{meta.candidate_name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{meta.candidate_email}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 italic">{meta.role}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-3xl font-bold leading-none ${scoreCls}`}>{score}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">/ 100</p>
                  </div>
                </div>

                {/* Score bar */}
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${scoreBar}`}
                    style={{ width: `${score}%` }} />
                </div>

                {/* Decision badge */}
                <div className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1
                                 rounded-full border font-semibold
                  ${meta.decision === "auto_interview"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : meta.decision === "manual_review"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      : "bg-red-500/15 text-red-400 border-red-500/20"}`}>
                  <Zap size={10} />
                  {meta.decision === "auto_interview" ? "Auto-Routed to Interview"
                    : meta.decision === "manual_review" ? "Pending Recruiter Review"
                    : "Below Threshold"}
                </div>

                {/* Message body */}
                <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-3 space-y-1">
                  {content.split("\n").map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-1" />;
                    return renderLine(line, i);
                  })}
                </div>

                {/* Registration link */}
                {meta.register_link && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800
                                  rounded-xl px-3 py-2">
                    <ExternalLink size={11} className="text-zinc-600 flex-shrink-0" />
                    <span className="text-[11px] text-zinc-400 truncate flex-1 font-mono">
                      {meta.register_link}
                    </span>
                    <button onClick={() => copyLink(meta.register_link)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800
                                 hover:bg-zinc-700 text-[10px] text-zinc-400 transition flex-shrink-0">
                      {copied
                        ? <CheckCircle2 size={10} className="text-emerald-400" />
                        : <Copy size={10} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}

                {actionError && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-[11px] font-medium">
                    <X size={12} className="flex-shrink-0" />
                    {actionError}
                  </div>
                )}

                {/* Action buttons — each tracks its own state independently */}
                {isTerminal ? (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold
                    ${completed.includes("proceed_onboarding")
                      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-400"
                      : "border-red-500/25 bg-red-500/5 text-red-400"}`}>
                    <CheckCircle2 size={13} />
                    {completed.includes("proceed_onboarding")
                      ? "Onboarding & compliance triggered — candidate hired"
                      : "Candidate declined"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Status chips for completed non-terminal actions */}
                    {(completed.includes("schedule_interview") || completed.includes("send_offer")) && (
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {completed.includes("schedule_interview") && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] font-semibold">
                            <CheckCircle2 size={10} /> Interview scheduled
                          </span>
                        )}
                        {completed.includes("send_offer") && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[10px] font-semibold">
                            <CheckCircle2 size={10} /> Offer sent — awaiting candidate response
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction("proceed_onboarding")}
                        disabled={acting !== null}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                                   rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white
                                   text-xs font-semibold disabled:opacity-50 transition"
                      >
                        {acting === "proceed_onboarding"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle2 size={12} />}
                        Proceed to Onboarding
                      </button>
                      <button
                        onClick={() => setShowDecline((o) => !o)}
                        disabled={acting !== null}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5
                                   rounded-xl border text-xs font-semibold
                                   disabled:opacity-50 transition
                          ${showDecline
                            ? "bg-red-600/20 border-red-500/40 text-red-400"
                            : "border-zinc-700 text-zinc-400 hover:border-red-500/30 hover:text-red-400"}`}
                      >
                        <X size={12} /> Decline
                      </button>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAction("schedule_interview")}
                        disabled={acting !== null || completed.includes("schedule_interview")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-50 transition
                          ${completed.includes("schedule_interview")
                            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 cursor-default"
                            : "border-zinc-700 text-zinc-300 hover:border-indigo-500/40 hover:text-indigo-400"}`}
                      >
                        {acting === "schedule_interview"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle2 size={12} />}
                        {completed.includes("schedule_interview") ? "Interview Scheduled" : "Schedule Interview"}
                      </button>
                      <button
                        onClick={() => handleAction("send_offer")}
                        disabled={acting !== null || completed.includes("send_offer")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold disabled:opacity-50 transition
                          ${completed.includes("send_offer")
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-400 cursor-default"
                            : "border-zinc-700 text-zinc-300 hover:border-blue-500/40 hover:text-blue-400"}`}
                      >
                        {acting === "send_offer"
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle2 size={12} />}
                        {completed.includes("send_offer") ? "Offer Sent" : "Send Offer"}
                      </button>
                    </div>

                    {showDecline && (
                      <div className="space-y-2">
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for declining (optional)..."
                          rows={2}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl
                                     px-3 py-2 text-xs text-white placeholder-zinc-600
                                     outline-none focus:border-zinc-600 transition resize-none"
                        />
                        <button
                          onClick={() => handleAction("decline_candidate")}
                          disabled={acting !== null}
                          className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500
                                     text-white text-xs font-semibold disabled:opacity-50 transition"
                        >
                          {acting === "decline_candidate"
                            ? <Loader2 size={12} className="animate-spin mx-auto" />
                            : "Confirm Decline"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Generic system message */
            <div className="px-4 py-3 space-y-1">
              {content.split("\n").map((line, i) => {
                if (!line.trim()) return <div key={i} className="h-1" />;
                return renderLine(line, i);
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// VOICE RECORDER
// ─────────────────────────────────────────
function useVoiceRecorder() {  const [recording, setRecording] = useState(false);
  const [duration,  setDuration]  = useState(0);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  const start = async () => {
    const { stream, error: mediaError } = await safeGetUserMedia({ audio: true });
    if (!stream || mediaError) { console.error("[VoiceRecorder]", mediaError); return; }
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.start(); mediaRef.current = mr; setRecording(true); setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };
  const stop = (): Promise<{ blob: Blob; duration: number }> =>
    new Promise((resolve) => {
      const mr = mediaRef.current; if (!mr) return;
      const dur = duration;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mr.stream.getTracks().forEach((t) => t.stop());
        resolve({ blob, duration: dur });
      };
      mr.stop(); setRecording(false); setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    });
  const cancel = () => {
    const mr = mediaRef.current; if (!mr) return;
    mr.stream.getTracks().forEach((t) => t.stop()); mr.stop();
    setRecording(false); setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  return { recording, duration, start, stop, cancel };
}

// ─────────────────────────────────────────
// VOICE PLAYER
// ─────────────────────────────────────────
function VoicePlayer({ url, secs }: { url: string; secs: number }) {  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.ontimeupdate = () =>
        setProgress((audioRef.current!.currentTime / audioRef.current!.duration) * 100);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button onClick={toggle}
        className="w-8 h-8 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30
                   flex items-center justify-center flex-shrink-0 transition">
        {playing
          ? <Pause size={14} className="text-indigo-400" />
          : <Play  size={14} className="text-indigo-400" />}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-400 rounded-full transition-all"
            style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-zinc-600 mt-0.5">{formatDuration(secs)}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────
function MessageBubble({
  message, isMine, profile, allMessages, allProfiles,
  currentUserId, onQuote, onRetract, onReact,
}: {
  message:       Message; isMine: boolean; profile: Profile | null;
  allMessages:   Message[]; allProfiles: Record<string, Profile>;
  currentUserId: string;
  onQuote:   (m: Message) => void;
  onRetract: (m: Message) => void;
  onReact:   (m: Message, e: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const quoted        = message.quoted_id
    ? allMessages.find((m) => m.id === message.quoted_id) : null;
  const quotedProfile = quoted?.user_id
    ? allProfiles[quoted.user_id] ?? null : null;

  return (
    <div
      className={`flex gap-2.5 group mb-0.5 px-3 py-1 rounded-lg transition-colors
        hover:bg-zinc-800/20 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      <div className="flex-shrink-0 self-end mb-1">
        <Avatar profile={profile} size="sm" />
      </div>

      <div className={`flex flex-col max-w-[72%] ${isMine ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 mb-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] font-semibold text-white/70">
            {profile?.full_name ?? message.user_name ?? "Unknown"}
          </span>
          <span className="text-[10px] text-zinc-600">{formatTime(message.created_at)}</span>
          {isMine && <CheckCheck size={11} className="text-zinc-700" />}
        </div>

        {quoted && (
          <div className={`mb-1.5 px-3 py-1.5 rounded-xl border-l-2 border-indigo-500
                           bg-indigo-500/5 max-w-full ${isMine ? "border-r-2 border-l-0" : ""}`}>
            <p className="text-[10px] text-indigo-400 font-semibold mb-0.5">
              {quotedProfile?.full_name ?? quoted.user_name ?? "Unknown"}
            </p>
            <p className="text-xs text-zinc-400 truncate max-w-[200px]">
              {quoted.retracted ? "Message retracted" : (quoted.content ?? "Attachment")}
            </p>
          </div>
        )}

        <div className={`relative rounded-2xl px-3.5 py-2.5 max-w-full break-words
          ${isMine
            ? "bg-indigo-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-white rounded-bl-sm"}
          ${message.retracted ? "opacity-50" : ""}`}>
          {message.retracted ? (
            <p className="text-xs text-zinc-400 italic">Message retracted</p>
          ) : (
            <>
              {message.type === "text" && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  <MentionText content={message.content ?? ""} />
                </p>
              )}
              {message.type === "meme" && <p className="text-2xl">{message.content}</p>}
              {message.type === "image" && message.file_url && (
                <div className="space-y-1.5">
                  <img src={message.file_url} alt={message.file_name ?? ""}
                    className="max-w-[280px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition"
                    onClick={() => window.open(message.file_url!, "_blank")} />
                  {message.file_name && (
                    <p className="text-[10px] text-white/50">{message.file_name}</p>
                  )}
                </div>
              )}
              {message.type === "file" && message.file_url && (
                <a href={message.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/20
                             hover:bg-black/30 transition min-w-[180px]">
                  <Download size={16} className="text-indigo-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium truncate">{message.file_name}</p>
                    <p className="text-[10px] text-white/40">Download</p>
                  </div>
                </a>
              )}
              {message.type === "voice" && message.voice_url && (
                <VoicePlayer url={message.voice_url} secs={message.voice_seconds ?? 0} />
              )}
            </>
          )}
        </div>

        {Object.keys(message.reactions ?? {}).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <button key={emoji} onClick={() => onReact(message, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition
                  ${(users as string[]).includes(currentUserId)
                    ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                {emoji} <span>{(users as string[]).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && !message.retracted && (
        <div className={`self-center flex items-center gap-1 opacity-0 group-hover:opacity-100
                         transition-opacity bg-zinc-900 border border-zinc-700
                         rounded-xl px-1.5 py-1 shadow-lg
          ${isMine ? "mr-1" : "ml-1"}`}>
          <button onClick={() => onQuote(message)}
            className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
            <Reply size={13} className="text-zinc-400" />
          </button>
          <div className="relative">
            <button onClick={() => setShowEmoji(!showEmoji)}
              className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
              <Smile size={13} className="text-zinc-400" />
            </button>
            {showEmoji && (
              <div className={`absolute bottom-9 z-50 bg-zinc-900 border border-zinc-700
                               rounded-2xl p-2 grid grid-cols-8 gap-1 shadow-2xl w-max
                ${isMine ? "right-0" : "left-0"}`}>
                {EMOJI_LIST.map((e) => (
                  <button key={e}
                    onClick={() => { onReact(message, e); setShowEmoji(false); }}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center
                               justify-center text-lg transition">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isMine && (
            <button onClick={() => onRetract(message)}
              className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition">
              <Trash2 size={13} className="text-zinc-500 hover:text-red-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// QUEUE PANEL
// ─────────────────────────────────────────
function QueuePanel({
  grouped, onResolve, onResolveAll,
}: {
  grouped:      Record<QueueCategory, QueueItem[]>;
  onResolve:    (id: string) => void;
  onResolveAll: (cat: QueueCategory) => void;
}) {
  const [expanded, setExpanded] = useState<QueueCategory | null>("escalations");
  const total = Object.values(grouped).reduce((s, i) => s + i.length, 0);
  const priorityColors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/25",
    high:     "bg-orange-500/15 text-orange-400 border-orange-500/25",
    normal:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
    low:      "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  if (total === 0) return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-600 gap-3">
      <CheckCircle2 size={32} className="opacity-30" />
      <p className="text-sm">Queue is clear</p>
    </div>
  );
  return (
    <div className="space-y-1 p-3">
      {QUEUE_SECTIONS.map(({ key, label, icon: Icon, color }) => {
        const items = grouped[key]; if (items.length === 0) return null;
        const isOpen = expanded === key;
        return (
          <div key={key} className="rounded-xl border border-zinc-800 overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : key)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800/50 transition">
              <Icon size={13} className={color} />
              <span className={`text-xs font-semibold flex-1 text-left ${color}`}>{label}</span>
              <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400
                               px-2 py-0.5 rounded-full font-medium">{items.length}</span>
              <ChevronDown size={11} className={`text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="border-t border-zinc-800">
                {items.map((item) => (
                  <div key={item.id}
                    className="flex items-start gap-3 px-3 py-2.5 border-b border-zinc-800/50
                               last:border-0 hover:bg-zinc-800/30 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium leading-tight truncate">
                        {item.title}
                      </p>
                      {item.summary && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold
                          ${priorityColors[item.priority] ?? priorityColors.low}`}>
                          {item.priority}
                        </span>
                        <span className="text-[9px] text-zinc-700">
                          {formatRelative(item.created_at)}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => onResolve(item.id)}
                      className="w-6 h-6 rounded-lg hover:bg-emerald-500/15 flex items-center
                                 justify-center transition flex-shrink-0 mt-0.5">
                      <CheckCircle2 size={13} className="text-zinc-600 hover:text-emerald-400" />
                    </button>
                  </div>
                ))}
                <button onClick={() => onResolveAll(key)}
                  className="w-full text-[10px] text-zinc-600 hover:text-zinc-400 py-2
                             text-center transition border-t border-zinc-800/50">
                  Clear all {label.toLowerCase()}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function ChatPage() {  const { tenantId, loading: tenantLoading } = useTenant();

  const [currentUser,    setCurrentUser]    = useState<Profile | null>(null);
  const { counts: unreadCounts, markRead } = useUnreadCounts(currentUser?.id ?? null);
  const [channels,       setChannels]       = useState<Channel[]>([]);
  const [dmChannels,     setDmChannels]     = useState<any[]>([]);
  const [activeChannel,  setActiveChannel]  = useState<Channel | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [allProfiles,    setAllProfiles]    = useState<Record<string, Profile>>({});
  const [profileList,    setProfileList]    = useState<Profile[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [rightPanel,     setRightPanel]     = useState<"queue" | "members" | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);

  const [myStatus,       setMyStatus]       = useState<UserStatus>("ONLINE");
  const [presenceMap,    setPresenceMap]    = useState<Record<string, UserStatus>>({});

  const [queueGrouped, setQueueGrouped] = useState<Record<QueueCategory, QueueItem[]>>({
    escalations: [], mentions: [], approvals: [], conversations: [], alerts: [],
  });
  const [queueCount, setQueueCount] = useState(0);

  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef   = useRef<Record<string, NodeJS.Timeout>>({});
  const [quotedMsg,   setQuotedMsg]   = useState<Message | null>(null);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [showMeme,    setShowMeme]    = useState(false);
  const [showNewChan, setShowNewChan] = useState(false);
  const [newChanName, setNewChanName] = useState("");

  const voice     = useVoiceRecorder();
  const fileRef   = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef  = useRef<(() => void) | null>(null);

  const mention = useMentionInput({
    profiles: profileList,
    tenantId,
    userId:   currentUser?.id ?? "",
    userName: currentUser?.full_name ?? currentUser?.email ?? "Unknown",
    context:  "chat",
    refId:    activeChannel?.id ?? null,
  });

  // ── Load current user ──────────────────
  useEffect(() => {
    const load = async () => {
      const p = await getCurrentProfile();
      if (p) { setCurrentUser(p); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setCurrentUser({
        id: session.user.id,
        full_name: session.user.email?.split("@")[0] ?? "User",
        email: session.user.email ?? null,
        department: null, position: null, role: null,
        avatar_url: null, tenant_id: "", timezone: null,
        location: null, work_mode: null, date_joined: null,
        phone: null, created_at: null, updated_at: null,
      });
    };
    load();
  }, []);

  // ── Load profiles ──────────────────────
  useEffect(() => {
    if (tenantLoading) return;
    getAllProfiles(tenantId).then((list) => {
      const map: Record<string, Profile> = {};
      list.forEach((p) => { map[p.id] = p; });
      setAllProfiles(map);
      setProfileList(list);
    });
  }, [tenantId, tenantLoading]);

  // ── Load channels ──────────────────────
  useEffect(() => {
    if (tenantLoading || !currentUser) return;
    supabase
      .from("channels")
      .select("*")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        const all     = data ?? [];
        const regular = all.filter((c: any) => !c.type || c.type === "channel");
        // Only show DMs where current user is a member
        const dms = all.filter(
          (c: any) => c.type === "dm" &&
            (c.member_one === currentUser.id || c.member_two === currentUser.id)
        );
        setChannels(regular as Channel[]);
        setDmChannels(dms);
        if (regular.length > 0 && !activeChannel) {
          setActiveChannel(regular[0] as Channel);
        }
        setLoading(false);
      });
  }, [tenantId, tenantLoading, currentUser?.id]);

  // ── Load messages + subscribe ──────────
  useEffect(() => {
    if (!activeChannel) return;
    if (unsubRef.current) unsubRef.current();

    const channelId = activeChannel.id;

    const fetchLatest = () => {
      getMessages(channelId).then((msgs) => {
        setMessages((prev) => {
          if (prev.length !== msgs.length) return msgs;
          const prevIds = new Set(prev.map((m) => m.id));
          const hasNew = msgs.some((m) => !prevIds.has(m.id));
          return hasNew ? msgs : prev;
        });
      });
    };

    fetchLatest();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    unsubRef.current = subscribeToChannel(
      channelId,
      (msg) => {
        setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
      (msg) => setMessages((prev) => prev.map((m) => m.id === msg.id ? msg : m))
    );

    // Polling fallback -- guards against realtime websocket disconnects,
    // which this environment has hit repeatedly. The comparison above
    // skips the state update entirely when nothing actually changed.
    const pollId = setInterval(fetchLatest, 8000);

    return () => {
      if (unsubRef.current) unsubRef.current();
      clearInterval(pollId);
    };
  }, [activeChannel]);

  // ── Presence ───────────────────────────
  useEffect(() => {
    if (!currentUser || tenantLoading) return;
    setUserPresence(currentUser.id, tenantId, "ONLINE").then(() => setMyStatus("ONLINE"));
    getTenantPresence(tenantId).then((all) => {
      const map: Record<string, UserStatus> = {};
      all.forEach((p: PresenceState) => { map[p.user_id] = p.status; });
      setPresenceMap(map);
    });
    const unsub = subscribeToPresence(tenantId, (p: PresenceState) =>
      setPresenceMap((prev) => ({ ...prev, [p.user_id]: p.status }))
    );
    const handleUnload = () => setOffline(currentUser.id, tenantId);
    window.addEventListener("beforeunload", handleUnload);
    return () => { unsub(); window.removeEventListener("beforeunload", handleUnload); };
  }, [currentUser, tenantId, tenantLoading]);

  // ── Queue ──────────────────────────────
  const loadQueue = useCallback(async () => {
    if (!currentUser || tenantLoading) return;
    const g = await getGroupedQueue(currentUser.id, tenantId);
    setQueueGrouped(g);
    setQueueCount(Object.values(g).reduce((s, i) => s + i.length, 0));
  }, [currentUser, tenantId, tenantLoading]);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (!currentUser || tenantLoading) return;
    return subscribeToQueue(currentUser.id, tenantId, (item) => {
      setQueueGrouped((prev) => ({
        ...prev,
        [item.category]: [item, ...(prev[item.category] ?? [])],
      }));
      setQueueCount((c) => c + 1);
    });
  }, [currentUser, tenantId, tenantLoading]);

  // ── Status change ──────────────────────
  const handleStatusChange = async (status: UserStatus) => {
    if (!currentUser) return;
    setMyStatus(status);
    setPresenceMap((prev) => ({ ...prev, [currentUser.id]: status }));
    await setUserPresence(currentUser.id, tenantId, status);
    // If viewing own profile, keep status in sync
    if (viewingProfile?.id === currentUser.id) {
      setPresenceMap((prev) => ({ ...prev, [currentUser.id]: status }));
    }
  };

  // ── Open / create DM ──────────────────
  // Open or create a DM channel between currentUser and profile
  const openDM = async (profile: Profile) => {
    if (!currentUser || profile.id === currentUser.id) return;

    // Two separate queries to find existing DM in either direction
    const { data: dirA } = await supabase
      .from("channels").select("*").eq("type", "dm")
      .eq("member_one", currentUser.id).eq("member_two", profile.id).limit(1);

    const { data: dirB } = await supabase
      .from("channels").select("*").eq("type", "dm")
      .eq("member_one", profile.id).eq("member_two", currentUser.id).limit(1);

    const found = dirA?.[0] ?? dirB?.[0] ?? null;

    if (found) {
      setActiveChannel(found as Channel);
      setDmChannels((prev) => prev.find((c) => c.id === found.id) ? prev : [...prev, found]);
    } else {
      // Create new — let Supabase generate the UUID
      const { data: created, error } = await supabase
        .from("channels")
        .insert({
          name:       profile.full_name ?? profile.email ?? "DM",
          tenant_id:  tenantId,
          type:       "dm",
          member_one: currentUser.id,
          member_two: profile.id,
          created_at: new Date().toISOString(),
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (!error && created) {
        setDmChannels((prev) => [...prev, created]);
        setActiveChannel(created as Channel);
      } else {
        console.error("DM create failed:", error?.message ?? error);
      }
    }

    setViewingProfile(null);
    setRightPanel(null);
  };

  // ── Send ───────────────────────────────
  const handleSend = async () => {
    const content = mention.value.trim();
    if (!content || !currentUser || !activeChannel || sending) return;
    setSending(true); mention.reset(); setQuotedMsg(null);
    try {
      await sendTextMessage({
        channelId: activeChannel.id, content,
        userId:    currentUser.id,
        userName:  currentUser.full_name ?? currentUser.email ?? "Unknown",
        tenantId,  quotedId: quotedMsg?.id ?? null,
      });
      await mention.processMentions(content);
    } catch (err) { console.error("Send failed:", err); mention.setValue(content); }
    finally { setSending(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !activeChannel) return;
    try {
      await uploadAndSendFile({
        channelId: activeChannel.id, userId: currentUser.id,
        userName:  currentUser.full_name ?? currentUser.email ?? "Unknown",
        tenantId, file, quotedId: quotedMsg?.id ?? null,
      });
      setQuotedMsg(null);
    } catch (err) { console.error("File send failed:", err); }
    e.target.value = "";
  };

  const handleVoiceStop = async () => {
    if (!currentUser || !activeChannel) return;
    const { blob, duration } = await voice.stop();
    try {
      await uploadAndSendVoice({
        channelId: activeChannel.id, userId: currentUser.id,
        userName:  currentUser.full_name ?? currentUser.email ?? "Unknown",
        tenantId, blob, durationSecs: duration,
      });
    } catch (err) { console.error("Voice send failed:", err); }
  };

  const handleRetract = async (msg: Message) => {
    if (!currentUser) return;
    try { await retractMessage(msg.id, currentUser.id); } catch {}
  };
  const handleReact = async (msg: Message, emoji: string) => {
    if (!currentUser) return;
    try { await toggleReaction(msg, emoji, currentUser.id); } catch {}
  };
  const handleCreateChannel = async () => {
    if (!newChanName.trim() || !currentUser) return;
    try {
      const ch = await createChannel(newChanName.trim(), tenantId, currentUser.id);
      setChannels((p) => [...p, ch]); setActiveChannel(ch);
      setNewChanName(""); setShowNewChan(false);
    } catch (err) { console.error("Create channel failed:", err); }
  };

  // ── Derived ─────────────────────────────
  const grouped = groupByDate(
    searchQuery
      ? messages.filter((m) =>
          (m.content ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        )
      : messages
  );

  const getDMOtherProfile = (ch: any): Profile | null => {
    if (!currentUser) return null;
    const otherId = ch.member_one === currentUser.id ? ch.member_two : ch.member_one;
    return allProfiles[otherId] ?? null;
  };
  const getDMDisplayName = (ch: any) => {
    const p = getDMOtherProfile(ch);
    return p?.full_name ?? p?.email ?? ch.name ?? "DM";
  };

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#080810] overflow-hidden">

      {/* Profile view panel */}
      {viewingProfile && (
        <ProfileViewPanel
          profile={viewingProfile}
          isOwnProfile={viewingProfile.id === currentUser.id}
          currentStatus={
            viewingProfile.id === currentUser.id
              ? myStatus
              : (presenceMap[viewingProfile.id] ?? "OFFLINE")
          }
          onClose={() => setViewingProfile(null)}
          onDM={openDM}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className="w-60 flex-shrink-0 border-r border-zinc-800 bg-[#09090f]
                      flex flex-col overflow-hidden">
        <div className="px-4 py-3.5 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">Pivot Teams</p>
            {currentUser && (
              <NotificationBell userId={currentUser.id} tenantId={tenantId} />
            )}
          </div>
          <div className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50
                          rounded-lg px-2.5 py-1.5">
            <Search size={11} className="text-zinc-600 flex-shrink-0" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..." className="flex-1 bg-transparent text-xs text-white
              placeholder-zinc-600 outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="px-3 mb-1 flex items-center justify-between">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
              Channels
            </p>
            <button onClick={() => setShowNewChan(true)}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-zinc-700 transition">
              <Plus size={11} className="text-zinc-500" />
            </button>
          </div>
          {channels.map((ch) => (
            <button key={ch.id} onClick={() => { setActiveChannel(ch as Channel); markRead(ch.id); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg mx-0.5
                          transition text-left
                ${activeChannel?.id === ch.id
                  ? "bg-indigo-500/15 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}>
              <Hash size={13} className="flex-shrink-0" />
              <span className="text-sm flex-1 truncate">{ch.name}</span>{(unreadCounts[ch.id] ?? 0) > 0 && activeChannel?.id !== ch.id && (<span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">{(unreadCounts[ch.id] ?? 0) > 99 ? "99+" : unreadCounts[ch.id]}</span>)}
            </button>
          ))}

          {/* DMs */}
          {dmChannels.length > 0 && (
            <>
              <div className="px-3 mt-4 mb-1">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
                  Direct Messages
                </p>
              </div>
              {dmChannels.map((ch) => {
                const dmP   = getDMOtherProfile(ch);
                const dmSt  = dmP ? (presenceMap[dmP.id] ?? "OFFLINE") : "OFFLINE";
                return (
                  <button key={ch.id} onClick={() => setActiveChannel(ch as Channel)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mx-0.5
                                transition text-left
                      ${activeChannel?.id === ch.id
                        ? "bg-indigo-500/15 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}>
                    <Avatar profile={dmP} size="xs" status={dmSt} />
                    <span className="text-sm flex-1 truncate">{getDMDisplayName(ch)}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Members */}
          <div className="px-3 mt-4 mb-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold">
              Members
            </p>
          </div>
          {profileList.filter((p) => p.id !== currentUser.id).slice(0, 15).map((p) => {
            const pStatus = presenceMap[p.id] ?? "OFFLINE";
            const pMeta   = STATUS_META[pStatus];
            return (
              <div key={p.id}
                className="flex items-center gap-2.5 px-3 py-1.5 mx-0.5 rounded-lg
                           hover:bg-zinc-800/30 transition cursor-pointer"
                onClick={() => setViewingProfile(p)}>
                <Avatar profile={p} size="xs" status={pStatus} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300 truncate">{p.full_name ?? p.email}</p>
                  <p className={`text-[9px] ${pMeta.color}`}>{pMeta.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — own profile */}
        <div className="border-t border-zinc-800 p-3 space-y-2">
          <div
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition"
            onClick={() => setViewingProfile(currentUser)}
          >
            <Avatar profile={currentUser} size="sm" status={myStatus} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser.full_name ?? currentUser.email}
              </p>
            </div>
          </div>
          <StatusSwitcher current={myStatus} onChange={handleStatusChange} />
        </div>
      </div>

      {/* ── MAIN CHAT ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
            Select a channel to start chatting
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800
                            bg-[#0a0a12] flex-shrink-0">
              {(activeChannel as any).type === "dm" ? (
                (() => {
                  const dmP  = getDMOtherProfile(activeChannel as any);
                  const dmSt = dmP ? (presenceMap[dmP.id] ?? "OFFLINE") : "OFFLINE";
                  return (
                    <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer
                                    hover:opacity-80 transition"
                      onClick={() => dmP && setViewingProfile(dmP)}>
                      <Avatar profile={dmP} size="sm" status={dmSt} />
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-white">
                          {getDMDisplayName(activeChannel as any)}
                        </h2>
                        <p className="text-[10px] text-zinc-600">
                          {STATUS_META[dmSt]?.label ?? ""}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Hash size={15} className="text-zinc-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-white">{activeChannel.name}</h2>
                    <p className="text-[10px] text-zinc-600">
                      {messages.filter((m) => !m.retracted && m.type !== "system").length} messages
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setRightPanel(rightPanel === "queue" ? null : "queue")}
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition
                    ${rightPanel === "queue"
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "hover:bg-zinc-800 text-zinc-500"}`}>
                  <Inbox size={15} />
                  {queueCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500
                                     flex items-center justify-center text-[9px] font-bold text-white">
                      {queueCount > 9 ? "9+" : queueCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setRightPanel(rightPanel === "members" ? null : "members")}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition
                    ${rightPanel === "members"
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "hover:bg-zinc-800 text-zinc-500"}`}>
                  <Users size={15} />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                  <Pin size={14} className="text-zinc-500" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                  <MoreHorizontal size={14} className="text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto py-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-2">
                      <Hash size={32} className="opacity-20" />
                      <p className="text-sm">No messages yet. Say hello 👋</p>
                    </div>
                  )}
                  {grouped.map(({ date, messages: dayMsgs }) => (
                    <div key={date}>
                      <div className="flex items-center gap-3 my-4 px-4">
                        <div className="flex-1 h-px bg-zinc-800" />
                        <span className="text-[11px] text-zinc-600 flex-shrink-0 px-3
                                         bg-zinc-900 rounded-full border border-zinc-800">
                          {date}
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                      {dayMsgs.map((msg) =>
                        msg.type === "system" ? (
                          <CandidateCard
                            key={msg.id}
                            message={msg}
                            currentUser={currentUser}
                            tenantId={tenantId}
                            onActioned={() =>
                              getMessages(activeChannel!.id).then(setMessages)
                            }
                          />
                        ) : (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isMine={msg.user_id === currentUser?.id}
                            profile={msg.user_id ? allProfiles[msg.user_id] ?? null : null}
                            allMessages={messages}
                            allProfiles={allProfiles}
                            currentUserId={currentUser?.id ?? ""}
                            onQuote={(m) => setQuotedMsg(m)}
                            onRetract={handleRetract}
                            onReact={handleReact}
                          />
                        )
                      )}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Typing indicator */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="px-5 py-1 flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[0,1,2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                )}

                {/* Typing indicator */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="px-5 py-1 flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[0,1,2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {Object.values(typingUsers).join(", ")} {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                )}

                {/* Compose */}
                <div className="flex-shrink-0 border-t border-zinc-800 bg-[#0a0a12] px-4 py-3">
                  {quotedMsg && (
                    <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2
                                    rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                      <div className="min-w-0">
                        <p className="text-[10px] text-indigo-400 font-semibold">
                          Replying to {allProfiles[quotedMsg.user_id ?? ""]?.full_name
                            ?? quotedMsg.user_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {quotedMsg.content ?? "Attachment"}
                        </p>
                      </div>
                      <button onClick={() => setQuotedMsg(null)}
                        className="flex-shrink-0 text-zinc-500 hover:text-white transition">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {voice.recording ? (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl
                                    bg-red-500/10 border border-red-500/20">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-red-400 font-mono flex-1">
                        {formatDuration(voice.duration)}
                      </span>
                      <button onClick={voice.cancel}
                        className="text-xs text-zinc-500 hover:text-white transition">
                        Cancel
                      </button>
                      <button onClick={handleVoiceStop}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500
                                   hover:bg-red-400 text-white text-xs font-semibold transition">
                        <StopCircle size={13} /> Send
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl
                                      px-4 py-2.5 min-h-[44px] flex items-end gap-2
                                      focus-within:border-zinc-600 transition">
                        <MentionInput
                          value={mention.value}
                          onChange={(v) => {
                            mention.setValue(v);
                            if (typingChannelRef.current && currentUser && activeChannel) {
                              typingChannelRef.current.send({
                                type: "broadcast", event: "typing",
                                payload: { userId: currentUser.id, userName: currentUser.full_name ?? currentUser.email ?? "Someone" },
                              });
                            }
                          }}
                          onSubmit={handleSend}
                          suggestions={mention.suggestions}
                          showSuggest={mention.showSuggest}
                          onSelectSuggestion={mention.selectSuggestion}
                          placeholder={
                            (activeChannel as any).type === "dm"
                              ? `Message ${getDMDisplayName(activeChannel as any)}…`
                              : `Message #${activeChannel.name}… use @ to mention`
                          }
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pb-0.5">
                        <div className="relative">
                          <button onClick={() => setShowEmoji(!showEmoji)}
                            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
                                       flex items-center justify-center transition">
                            <Smile size={16} className="text-zinc-400" />
                          </button>
                          {showEmoji && (
                            <div className="absolute bottom-11 right-0 bg-zinc-900 border
                                            border-zinc-700 rounded-2xl p-2 grid grid-cols-8
                                            gap-1 shadow-2xl z-50 w-max">
                              {EMOJI_LIST.map((e) => (
                                <button key={e}
                                  onClick={() => {
                                    mention.setValue(mention.value + e);
                                    setShowEmoji(false);
                                  }}
                                  className="w-8 h-8 rounded-lg hover:bg-zinc-800
                                             flex items-center justify-center text-lg transition">
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <button onClick={() => setShowMeme(!showMeme)}
                            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
                                       flex items-center justify-center transition
                                       text-xs font-bold text-zinc-400">
                            GIF
                          </button>
                          {showMeme && (
                            <div className="absolute bottom-11 right-0 bg-zinc-900 border
                                            border-zinc-700 rounded-2xl p-2 space-y-1
                                            shadow-2xl z-50 w-44">
                              {MEMES.map((m) => (
                                <button key={m.label}
                                  onClick={async () => {
                                    setShowMeme(false);
                                    if (currentUser && activeChannel) {
                                      await sendTextMessage({
                                        channelId: activeChannel.id, content: m.content,
                                        userId:    currentUser.id,
                                        userName:  currentUser.full_name ?? currentUser.email ?? "Unknown",
                                        tenantId,  quotedId: null,
                                      });
                                    }
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-xl text-sm
                                             text-zinc-300 hover:bg-zinc-800 transition">
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => fileRef.current?.click()}
                          className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
                                     flex items-center justify-center transition">
                          <Paperclip size={16} className="text-zinc-400" />
                        </button>
                        <button onClick={voice.start}
                          className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
                                     flex items-center justify-center transition">
                          <Mic size={16} className="text-zinc-400" />
                        </button>
                        <button onClick={handleSend} disabled={sending || !mention.value.trim()}
                          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500
                                     flex items-center justify-center transition disabled:opacity-40">
                          {sending
                            ? <Loader2 size={15} className="text-white animate-spin" />
                            : <Send    size={15} className="text-white" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-700 mt-1.5 px-1">
                    <span className="text-zinc-500">@name</span> · person{"  "}
                    <span className="text-zinc-500">@dept</span> · team{"  "}
                    <span className="text-amber-600">@all</span> · everyone
                  </p>
                </div>
              </div>

              {/* Right panel */}
              {rightPanel && (
                <div className="w-72 flex-shrink-0 border-l border-zinc-800 bg-[#09090f]
                                flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-semibold text-white">
                      {rightPanel === "queue" ? "Attention Queue" : "Members"}
                    </p>
                    <button onClick={() => setRightPanel(null)}
                      className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center
                                 justify-center transition">
                      <X size={13} className="text-zinc-500" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {rightPanel === "queue" && (
                      <QueuePanel
                        grouped={queueGrouped}
                        onResolve={async (id) => { await resolveQueueItem(id); loadQueue(); }}
                        onResolveAll={async (cat) => {
                          if (currentUser) {
                            await resolveCategory(currentUser.id, tenantId, cat);
                            loadQueue();
                          }
                        }}
                      />
                    )}
                    {rightPanel === "members" && (
                      <div className="p-3 space-y-1">
                        {profileList.map((p) => {
                          const pStatus = presenceMap[p.id] ?? "OFFLINE";
                          const pMeta   = STATUS_META[pStatus];
                          return (
                            <div key={p.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                                         hover:bg-zinc-800/40 transition cursor-pointer"
                              onClick={() => setViewingProfile(p)}>
                              <Avatar profile={p} size="md" status={pStatus} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-white font-medium truncate">
                                  {p.full_name ?? p.email}
                                </p>
                                <p className={`text-xs ${pMeta.color}`}>
                                  {pMeta.emoji} {pMeta.label}
                                </p>
                                {p.department && (
                                  <p className="text-[10px] text-zinc-600">{p.department}</p>
                                )}
                              </div>
                              {p.id !== currentUser.id && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDM(p); }}
                                  className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-indigo-500/20
                                             flex items-center justify-center transition flex-shrink-0">
                                  <MessageSquare size={13} className="text-zinc-500 hover:text-indigo-400" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />

      {/* Create channel modal */}
      {showNewChan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                        bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800
                          rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Create Channel</h3>
              <button onClick={() => setShowNewChan(false)}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center
                           justify-center transition">
                <X size={14} className="text-zinc-400" />
              </button>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Channel name</label>
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700
                              rounded-xl px-3 py-2.5 focus-within:border-indigo-500 transition">
                <Hash size={14} className="text-zinc-500 flex-shrink-0" />
                <input value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
                  placeholder="e.g. general" autoFocus
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewChan(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                           text-zinc-400 hover:text-white transition">Cancel</button>
              <button onClick={handleCreateChannel} disabled={!newChanName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white
                           text-sm font-semibold transition disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




