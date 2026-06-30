"use client";

import { useEffect, useState, useRef }                              from "react";
import { useRouter }                                                from "next/navigation";
import { DndContext, useDraggable, useDroppable }                   from "@dnd-kit/core";

import { supabase }                                                 from "../../../lib/supabase";
import { useUser }                                                  from "../../../lib/useUser";
import { moveCandidateOptimistic }                                  from "../../../lib/realtime/optimistic";
import { emitCandidateEvent }                                       from "../../../lib/core/event-bus";
import { handleRecruitmentToOnboarding }                            from "../../../lib/recruitment/recruitment.hooks";
import { xavierNotify, getXavierNotifications }                     from "../../../lib/recruitment/xavier.notifications";
import { getScoreThresholds, upsertScoreThresholds }                from "../../../lib/recruitment/scoring.engine";
import { sendOfferLetterEmail }                                     from "../../../lib/recruitment/email.service";

import {
  Brain, Bell, Settings2, Plus, CheckCircle2,
  XCircle, Send, ChevronDown, ExternalLink,
  FileText, Loader2, X, AlertTriangle,
  Link2, Copy,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Candidate {
  id:              string;
  name:            string;
  email:           string;
  role:            string;
  status:          string;
  ai_score:        number | null;
  ai_summary:      string | null;
  ai_flags:        string[] | null;
  decision:        string | null;
  resume_url:      string | null;
  resume_name:     string | null;
  source:          string | null;
  tenant_id:       string | null;
}

interface XavierNotification {
  id:           string;
  stage:        string;
  message:      string;
  type:         string;
  read:         boolean;
  created_at:   string;
  candidate_id: string | null;
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const STATUSES = [
  "new", "screening", "assessment",
  "interview", "recruitment_review", "hired", "rejected",
];

const COLUMN_LABELS: Record<string, string> = {
  new:                "New",
  screening:          "Screening",
  assessment:         "Assessment",
  interview:          "Interview",
  recruitment_review: "Review",
  hired:              "Hired",
  rejected:           "Rejected",
};

// Map real DB statuses (some set by other flows) into a visible board column,
// so no candidate ever falls outside the columns and disappears.
function normalizeStatus(s: string | null | undefined): string {
  const map: Record<string, string> = {
    registered:  "interview",            // registered after scoring -> in process
    shortlisted: "recruitment_review",   // legacy -> Review
    onboarding:  "hired",
  };
  const v = map[s ?? ""] ?? s ?? "new";
  return STATUSES.includes(v) ? v : "new"; // unknown -> New (never lost)
}

const SCORE_COLORS = (score: number | null) => {
  if (!score) return "text-zinc-500";
  if (score >= 80) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
};

const getId = (c: any) => String(c?.id ?? c?.uuid ?? c?.candidate_id ?? "");

// ─────────────────────────────────────────
// DRAGGABLE CARD
// ─────────────────────────────────────────
function DraggableCard({
  candidate, onClick,
}: {
  candidate: Candidate;
  onClick:   (c: Candidate) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: candidate.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClick(candidate)}
      style={{
        transform:          transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
        opacity:            isDragging ? 0.6 : 1,
        willChange:         "transform",
        WebkitFontSmoothing:"antialiased",
        backfaceVisibility: "hidden",
      }}
      className="mb-2 cursor-grab select-none rounded-xl border border-zinc-800
                 bg-zinc-900 px-3 py-3 transition-colors hover:border-zinc-700
                 hover:bg-zinc-800 active:scale-[0.98]"
    >
      <p className="text-sm font-medium text-white leading-snug truncate">
        {candidate.name}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500 truncate">{candidate.email}</p>
      {candidate.role && (
        <p className="mt-1 text-[10px] text-zinc-600 truncate">{candidate.role}</p>
      )}
      {candidate.ai_score != null && (
        <div className="mt-2 flex items-center gap-1.5">
          <Brain size={10} className="text-indigo-400" />
          <span className={`text-xs font-semibold ${SCORE_COLORS(candidate.ai_score)}`}>
            {candidate.ai_score}/100
          </span>
          {candidate.source === "application_form" && (
            <span className="ml-auto text-[9px] bg-indigo-500/10 text-indigo-400
                             border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
              Via Form
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// COLUMN
// ─────────────────────────────────────────
function Column({
  status, candidates, onClick,
}: {
  status:     string;
  candidates: Candidate[];
  onClick:    (c: Candidate) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-shrink-0 w-56 rounded-xl border p-3 min-h-[520px]
                  bg-[#0f0f1a] transition-colors duration-150
                  ${isOver ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.08]"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold tracking-widest text-white/40 uppercase">
          {COLUMN_LABELS[status] ?? status}
        </h3>
        <span className="text-[10px] text-white/25 tabular-nums">{candidates.length}</span>
      </div>

      {candidates.length === 0 && (
        <div className="flex items-center justify-center h-16 rounded-lg
                        border border-dashed border-white/[0.06] text-[11px] text-white/20">
          Drop here
        </div>
      )}
      {candidates.map((c) => (
        <DraggableCard key={c.id} candidate={c} onClick={onClick} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// CANDIDATE DETAIL PANEL
// ─────────────────────────────────────────
function CandidatePanel({
  candidate, onClose, onAction, tenantId,
}: {
  candidate: Candidate;
  onClose:   () => void;
  onAction:  (action: "approve" | "reject" | "offer", extra?: string) => void;
  tenantId:  string;
}) {
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline,   setShowDecline]   = useState(false);
  const [acting,        setActing]        = useState(false);

  const isInterview = candidate.status === "interview";
  const isReview    = candidate.status === "recruitment_review";
  const score       = candidate.ai_score ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[#0a0a14] border-l border-zinc-800
                      overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[#0a0a14] z-10">
          <h2 className="text-sm font-semibold text-white">Candidate Profile</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Identity */}
          <div>
            <h3 className="text-lg font-bold text-white">{candidate.name}</h3>
            <p className="text-sm text-zinc-400">{candidate.email}</p>
            {candidate.role && <p className="text-xs text-zinc-600 mt-0.5">{candidate.role}</p>}
          </div>

          {/* Xavier AI Score */}
          {candidate.ai_score != null && (
            <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-400">Xavier AI Assessment</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-3xl font-bold ${SCORE_COLORS(candidate.ai_score)}`}>
                  {candidate.ai_score}
                </span>
                <span className="text-zinc-600 text-sm">/ 100</span>
                <span className={`ml-auto text-[11px] px-2.5 py-1 rounded-full border font-semibold
                  ${score >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                    score >= 70 ? "bg-amber-500/15 text-amber-400 border-amber-500/25"       :
                                  "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                  {score >= 80 ? "Strong" : score >= 70 ? "Review" : "Weak"}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full ${
                    score >= 80 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
              {candidate.ai_summary && (
                <p className="text-xs text-zinc-500 leading-relaxed">{candidate.ai_summary}</p>
              )}
              {candidate.ai_flags && candidate.ai_flags.length > 0 && (
                <div className="mt-2 space-y-1">
                  {candidate.ai_flags.map((flag) => (
                    <div key={flag} className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
                      <AlertTriangle size={10} />
                      {flag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resume */}
          {candidate.resume_url && (
            <a
              href={candidate.resume_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800
                         bg-zinc-900 hover:border-zinc-700 transition group"
            >
              <FileText size={16} className="text-zinc-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white truncate">
                  {candidate.resume_name ?? "Resume"}
                </p>
                <p className="text-xs text-zinc-600">Click to open</p>
              </div>
              <ExternalLink size={13} className="ml-auto text-zinc-600 group-hover:text-zinc-400 transition" />
            </a>
          )}

          {/* Status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500 mb-1">Current Stage</p>
            <p className="text-sm font-semibold text-white capitalize">
              {COLUMN_LABELS[candidate.status] ?? candidate.status}
            </p>
          </div>

          {/* ── INTERVIEW ACTIONS ── */}
          {isInterview && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Interview Decision
              </p>

              <button
                onClick={() => { setActing(true); onAction("approve"); }}
                disabled={acting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                           bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                           disabled:opacity-50 transition"
              >
                <CheckCircle2 size={15} />
                Approve — Send Offer Letter
              </button>

              <button
                onClick={() => setShowDecline((o) => !o)}
                disabled={acting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                           bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30
                           text-sm font-semibold disabled:opacity-50 transition"
              >
                <XCircle size={15} />
                Reject Candidate
                <ChevronDown size={13} className={`ml-auto transition-transform ${showDecline ? "rotate-180" : ""}`} />
              </button>

              {showDecline && (
                <div className="space-y-2">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="State reason for rejection (shown to recruiter, not sent to candidate)..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                               text-sm text-white placeholder-zinc-600 outline-none
                               focus:border-zinc-600 transition resize-none"
                  />
                  <button
                    onClick={() => { setActing(true); onAction("reject", declineReason); }}
                    disabled={acting}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500
                               text-white text-sm font-semibold disabled:opacity-50 transition"
                  >
                    {acting ? "Processing..." : "Confirm Rejection"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW ACTIONS ── */}
          {isReview && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Recruiter Decision
              </p>
              <p className="text-xs text-zinc-500">
                This candidate scored {score}/100 and was routed here for manual review.
                Approve to move to interview or reject to archive.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setActing(true); onAction("approve"); }}
                  disabled={acting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                             disabled:opacity-50 transition"
                >
                  <CheckCircle2 size={14} /> Move to Interview
                </button>
                <button
                  onClick={() => setShowDecline((o) => !o)}
                  disabled={acting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                             border border-red-500/30 text-red-400 hover:bg-red-500/10
                             text-sm font-semibold disabled:opacity-50 transition"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>
              {showDecline && (
                <div className="space-y-2">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5
                               text-sm text-white placeholder-zinc-600 outline-none resize-none"
                  />
                  <button
                    onClick={() => { setActing(true); onAction("reject", declineReason); }}
                    disabled={acting}
                    className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm
                               font-semibold disabled:opacity-50 transition hover:bg-red-500"
                  >
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// THRESHOLD SETTINGS PANEL
// ─────────────────────────────────────────
function ThresholdPanel({
  tenantId, onClose,
}: {
  tenantId: string;
  onClose:  () => void;
}) {
  const [autoInterview, setAutoInterview] = useState(80);
  const [manualReview,  setManualReview]  = useState(70);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => {
    getScoreThresholds(tenantId).then((t) => {
      setAutoInterview(t.auto_interview);
      setManualReview(t.manual_review);
    });
  }, [tenantId]);

  const handleSave = async () => {
    setError("");
    if (autoInterview <= manualReview) {
      setError("Auto-interview threshold must be higher than manual review threshold");
      return;
    }
    setSaving(true);
    try {
      await upsertScoreThresholds(tenantId, autoInterview, manualReview);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Xavier AI Score Thresholds</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Adjust how Xavier AI routes candidates based on their application score.
          Changes apply to all new applications.
        </p>

        {/* Auto interview */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <label className="font-medium text-white flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-400" />
              Auto Interview — score ≥
            </label>
            <span className="text-emerald-400 font-bold">{autoInterview}</span>
          </div>
          <input
            type="range" min={50} max={95} step={5}
            value={autoInterview}
            onChange={(e) => setAutoInterview(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <p className="text-[11px] text-zinc-600 mt-1">
            Candidates scoring ≥ {autoInterview} are automatically moved to Interview
          </p>
        </div>

        {/* Manual review */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-2">
            <label className="font-medium text-white flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-400" />
              Manual Review — score ≥
            </label>
            <span className="text-amber-400 font-bold">{manualReview}</span>
          </div>
          <input
            type="range" min={30} max={autoInterview - 5} step={5}
            value={manualReview}
            onChange={(e) => setManualReview(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <p className="text-[11px] text-zinc-600 mt-1">
            Scores {manualReview}–{autoInterview - 1} → recruitment-review channel for manual decision
          </p>
        </div>

        {/* Auto reject */}
        <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <XCircle size={12} className="text-red-400" />
            <span className="text-white font-medium">Auto Reject — score &lt; {manualReview}</span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1">
            Automatic rejection email sent. Candidate archived.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20
                        rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm
                       text-zinc-400 hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                       text-white text-sm font-semibold disabled:opacity-50 transition">
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Thresholds"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function RecruitmentBoard() {
  const { user, loading } = useUser();
  const router = useRouter();

  const [candidates,      setCandidates]      = useState<Candidate[]>([]);
  const [notifications,   setNotifications]   = useState<XavierNotification[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [applyLink,          setApplyLink]          = useState("");
  const [copied,             setCopied]             = useState(false);
  const [showThresholds,  setShowThresholds]  = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [tenantId,        setTenantId]        = useState("");

  const lastActionRef  = useRef<string | null>(null);
  const localUpdateRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Load tenant
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const { data: profile } = await supabase
        .from("profiles").select("tenant_id").eq("id", data.session.user.id).single();
      if (profile?.tenant_id) setTenantId(profile.tenant_id);
    });
  }, []);

  // Fetch apply link from tenant record
  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("tenants")
      .select("apply_link, id, org_name")
      .eq("id", tenantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setApplyLink(
            data.apply_link ?? `https://www.pivotops.app/apply/${data.id}`
          );
        }
      });
  }, [tenantId]);


  // Load candidates
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("candidates").select("*").order("created_at", { ascending: false });
      if (!mounted || error) return;
      setCandidates(data ?? []);
    };
    load();

    const channel = supabase.channel("recruitment-live")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        (payload) => {
          const updated = payload?.new as Candidate;
          if (!updated) return;
          const id = updated.id;
          if (localUpdateRef.current.has(id)) { localUpdateRef.current.delete(id); return; }
          setCandidates((prev) => {
            const exists = prev.some((c) => c.id === id);
            return exists ? prev.map((c) => c.id === id ? { ...c, ...updated } : c) : [updated, ...prev];
          });
        }
      ).subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, []);

  // Load Xavier notifications
  useEffect(() => {
    const load = async () => {
      const data = await getXavierNotifications(tenantId, 30);
      setNotifications(data as XavierNotification[]);
    };
    load();

    const channel = supabase.channel("xavier-live")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "xavier_notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as XavierNotification, ...prev].slice(0, 30));
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Candidate panel action handler ────────
  const handleCandidateAction = async (
    action: "approve" | "reject" | "offer",
    extra?: string
  ) => {
    if (!selectedCandidate || !user) return;
    const c = selectedCandidate;

    try {
      if (c.status === "interview" && action === "approve") {
        // Send offer letter
        await supabase.from("candidates")
          .update({ status: "recruitment_review", decision: "STRONG_HIRE", updated_at: new Date().toISOString() })
          .eq("id", c.id);

        // Create offer letter record
        const { data: offer } = await supabase.from("offer_letters")
          .insert({
            candidate_id: c.id,
            tenant_id:    tenantId,
            position:     c.role ?? "Position",
            start_date:   new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            status:       "sent",
            sent_at:      new Date().toISOString(),
            created_by:   user.id,
          })
          .select().single();

        // Xavier notify
        await xavierNotify({
          tenantId,
          candidateId:   c.id,
          stage:         "interview_approved",
          candidateName: c.name,
        });

        await xavierNotify({
          tenantId,
          candidateId:   c.id,
          stage:         "offer_sent",
          candidateName: c.name,
        });

        // Send offer email
        const baseUrl = window.location.origin;
        await sendOfferLetterEmail({
          to:            c.email,
          orgName:       tenantId ?? "PivotOps",
          candidateName: c.name,
          roleName:      c.role ?? "Position",
          startDate:     new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          acceptUrl:     `${baseUrl}/api/recruitment/offer?offerId=${offer?.id}&action=accept&candidateId=${c.id}`,
          declineUrl:    `${baseUrl}/api/recruitment/offer?offerId=${offer?.id}&action=decline&candidateId=${c.id}`,
        });

        setCandidates((prev) =>
          prev.map((x) => x.id === c.id ? { ...x, status: "recruitment_review" } : x)
        );

      } else if (c.status === "interview" && action === "reject") {
        await supabase.from("candidates")
          .update({ status: "rejected", decision: "REJECT", updated_at: new Date().toISOString() })
          .eq("id", c.id);

        await xavierNotify({
          tenantId,
          candidateId:   c.id,
          stage:         "interview_rejected",
          candidateName: c.name,
          extra,
        });

        setCandidates((prev) =>
          prev.map((x) => x.id === c.id ? { ...x, status: "rejected" } : x)
        );

      } else if (c.status === "recruitment_review" && action === "approve") {
        await supabase.from("candidates")
          .update({ status: "interview", updated_at: new Date().toISOString() })
          .eq("id", c.id);

        await xavierNotify({
          tenantId,
          candidateId:   c.id,
          stage:         "interview_scheduled",
          candidateName: c.name,
        });

        setCandidates((prev) =>
          prev.map((x) => x.id === c.id ? { ...x, status: "interview" } : x)
        );

      } else if (c.status === "recruitment_review" && action === "reject") {
        await supabase.from("candidates")
          .update({ status: "rejected", decision: "REJECT", updated_at: new Date().toISOString() })
          .eq("id", c.id);

        await xavierNotify({
          tenantId,
          candidateId:   c.id,
          stage:         "interview_rejected",
          candidateName: c.name,
          extra,
        });

        setCandidates((prev) =>
          prev.map((x) => x.id === c.id ? { ...x, status: "rejected" } : x)
        );
      }

      setSelectedCandidate(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Candidate action failed:", msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  const notifColors: Record<string, string> = {
    success: "text-emerald-400", info: "text-blue-400",
    warning: "text-amber-400",   alert: "text-red-400",
  };

  return (
    <>
      {selectedCandidate && (
        <CandidatePanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onAction={handleCandidateAction}
          tenantId={tenantId}
        />
      )}

      {showThresholds && (
        <ThresholdPanel
          tenantId={tenantId}
          onClose={() => setShowThresholds(false)}
        />
      )}

      <div className="p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Recruitment Board</h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              {candidates.length} candidates · Xavier AI scoring active
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Xavier notifications bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications((o) => !o)}
                className="relative w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800
                           hover:border-zinc-700 flex items-center justify-center transition"
              >
                <Bell size={15} className="text-zinc-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full
                                   bg-indigo-500 text-white text-[9px] font-bold
                                   flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto
                                bg-[#0f0f1a] border border-zinc-800 rounded-2xl shadow-2xl z-50">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain size={13} className="text-indigo-400" />
                      <span className="text-xs font-semibold text-white">Xavier AI Updates</span>
                    </div>
                    <button onClick={() => setShowNotifications(false)} className="text-zinc-600 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-6">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id}
                        className={`px-4 py-3 border-b border-zinc-800/50 text-xs leading-relaxed
                          ${!n.read ? "bg-indigo-500/5" : ""}`}>
                        <p className={notifColors[n.type] ?? "text-zinc-400"}>{n.message}</p>
                        <p className="text-zinc-700 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Threshold settings */}
            <button
              onClick={() => setShowThresholds(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900
                         border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400
                         hover:text-white transition"
            >
              <Settings2 size={13} />
              Score Thresholds
            </button>

            {/* Apply link — tenant portal URL */}
            {applyLink && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 max-w-sm">
                <Link2 size={13} className="text-indigo-400 flex-shrink-0" />
                <span className="text-xs text-indigo-300 font-mono truncate flex-1">{applyLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(applyLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-white transition flex-shrink-0"
                >
                  {copied
                    ? <><CheckCircle2 size={12} className="text-emerald-400" />&nbsp;Copied!</>
                    : <><Copy size={12} />&nbsp;Copy</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Board */}
        <DndContext
          onDragEnd={async ({ active, over }) => {
            if (!over || !user) return;
            const candidateId = String(active.id);
            const newStatus   = String(over.id);
            const candidate   = candidates.find((c) => c.id === candidateId);
            if (!candidate || candidate.status === newStatus) return;

            const key = `${candidateId}-${newStatus}`;
            if (lastActionRef.current === key) return;
            lastActionRef.current = key;

            const snapshot = [...candidates];
            try {
              localUpdateRef.current.add(candidateId);
              setCandidates((prev) =>
                prev.map((c) => c.id === candidateId ? { ...c, status: newStatus } : c)
              );
              await moveCandidateOptimistic(candidate, newStatus, tenantId);
              await emitCandidateEvent({
                type: "CANDIDATE_STATUS_CHANGED",
                payload: {
                  candidate_id: candidateId,
                  status:       newStatus,
                  tenant_id:    tenantId,
                  actor:        { id: user?.id ?? "system", email: user?.email ?? null, name: user?.email ?? "System" },
                  timestamp:    new Date().toISOString(),
                },
              });

              // Xavier notification to Candidates channel
              const stageMap: Record<string, any> = {
                interview:           "interview_scheduled",
                interview_scheduled: "interview_scheduled",
                recruitment_review:  "manual_review",
                offer_sent:          "offer_sent",
                offer_accepted:      "offer_accepted",
                offer_declined:      "offer_declined",
                onboarding:          "onboarding_triggered",
                hired:               "onboarding_triggered",
                rejected:            "auto_reject",
                manual_review:       "manual_review",
              };
              const mappedStage = stageMap[newStatus];
              if (mappedStage) {
                try {
                  await xavierNotify({
                    tenantId,
                    candidateId,
                    stage:         mappedStage,
                    candidateName: candidate.name ?? "Candidate",
                    extra:         `Moved by ${user?.email ?? "a recruiter"} from ${candidate.status?.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")}`,
                  });
                } catch (notifyErr) {
                  console.error("Xavier notify failed (non-blocking):", notifyErr);
                }
              }
              try {
                await handleRecruitmentToOnboarding(candidate, supabase, newStatus);
              } catch (onbErr) {
                console.error("Onboarding sync failed (non-blocking):", onbErr);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("Move failed:", msg);
              setCandidates(snapshot);
              localUpdateRef.current.delete(candidateId);
            }
            setTimeout(() => { lastActionRef.current = null; }, 250);
          }}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                candidates={candidates.filter((c) => normalizeStatus(c?.status) === status)}
                onClick={(c) => setSelectedCandidate(c)}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </>
  );
}
