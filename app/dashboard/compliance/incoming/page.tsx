"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  CheckCircle2, XCircle, Eye, FileText, AlertCircle,
  Loader2, RefreshCw, Search, ChevronDown, Shield,
  Clock, User, Download, Filter
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CREDENTIAL_LABELS: Record<string, string> = {
  resume:           "Resume / CV",
  nursing_license:  "Nursing License",
  drivers_license:  "Driver's License",
  flu_shot:         "Flu Shot Record",
  covid_vaccine:    "COVID-19 Vaccination",
  hep_b:            "Hepatitis B Record",
  mmr:              "MMR Vaccination",
  chest_xray:       "Chest X-Ray",
  bls_cpr:          "BLS / CPR Certification",
  drug_screening:   "Drug Screening Results",
  background_check: "Background Check",
};

const TOTAL_DOCS = Object.keys(CREDENTIAL_LABELS).length;

interface Credential {
  id:               string;
  candidate_id:     string;
  doc_type:         string;
  file_url:         string | null;
  file_name:        string | null;
  file_size:        number | null;
  status:           "pending" | "uploaded" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_by:      string | null;
  reviewed_at:      string | null;
  submitted_at:     string | null;
  updated_at:       string | null;
}

interface CandidateGroup {
  candidate_id:   string;
  candidate_name: string;
  candidate_email:string;
  credentials:    Credential[];
  submitted_at:   string;
  status:         "pending" | "partial" | "complete" | "rejected";
}

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

function statusColor(s: string) {
  if (s === "approved" || s === "complete") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (s === "rejected")                     return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s === "partial")                      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (s === "uploaded")                     return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
}

function statusLabel(s: string) {
  if (s === "approved" || s === "complete") return "Approved";
  if (s === "rejected")                     return "Rejected";
  if (s === "partial")                      return "Partial";
  if (s === "uploaded")                     return "Under Review";
  return "Pending";
}

function computeGroupStatus(creds: Credential[]): CandidateGroup["status"] {
  if (creds.length === 0) return "pending";
  const approved = creds.filter(c => c.status === "approved").length;
  const rejected = creds.some(c => c.status === "rejected");
  if (approved === TOTAL_DOCS) return "complete";
  if (rejected) return "rejected";
  if (approved > 0) return "partial";
  return "pending";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024*1024 ? `${(bytes/1024/1024).toFixed(1)}MB` : `${(bytes/1024).toFixed(0)}KB`;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel, loading }: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:24, width:400 }}>
        <p style={{ color:"#fff", fontWeight:600, marginBottom:8 }}>Reject Document</p>
        <p style={{ color:"rgba(255,255,255,0.4)", fontSize:13, marginBottom:16 }}>Provide a reason — the candidate will see this.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Document is expired, please re-upload a current version."
          style={{ width:"100%", background:"#0a0a0a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:10, color:"#fff", fontSize:13, resize:"vertical", minHeight:80, outline:"none" }} />
        <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim() || loading}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#ef4444", color:"#fff", fontSize:13, cursor:"pointer", opacity: reason.trim() ? 1 : 0.4, display:"flex", alignItems:"center", gap:6 }}>
            {loading && <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} />}
            Reject Document
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credential card ───────────────────────────────────────────────────────────
function CredentialCard({ cred, reviewer, onUpdate }: {
  cred:     Credential;
  reviewer: string;
  onUpdate: (updated: Credential) => void;
}) {
  const [acting,   setActing]   = useState<"approve"|"reject"|null>(null);
  const [viewing,  setViewing]  = useState(false);
  const [showReject, setShowReject] = useState(false);

  const approve = async () => {
    setActing("approve");
    await withRetry(async () => {
      const { data, error } = await supabase
        .from("candidate_credentials")
        .update({ status:"approved", reviewed_by:reviewer, reviewed_at:new Date().toISOString(), rejection_reason:null, updated_at:new Date().toISOString() })
        .eq("id", cred.id).select().single();
      if (error) throw error;
      onUpdate(data as Credential);
    });
    setActing(null);
  };

  const reject = async (reason: string) => {
    setActing("reject");
    await withRetry(async () => {
      const { data, error } = await supabase
        .from("candidate_credentials")
        .update({ status:"rejected", reviewed_by:reviewer, reviewed_at:new Date().toISOString(), rejection_reason:reason, updated_at:new Date().toISOString() })
        .eq("id", cred.id).select().single();
      if (error) throw error;
      onUpdate(data as Credential);
    });
    setActing(null);
    setShowReject(false);
  };

  const label = CREDENTIAL_LABELS[cred.doc_type] ?? cred.doc_type;
  const isApproved = cred.status === "approved";
  const isRejected = cred.status === "rejected";
  const hasFile    = !!cred.file_url;

  return (
    <>
      {showReject && <RejectModal onConfirm={reject} onCancel={() => setShowReject(false)} loading={acting === "reject"} />}
      {viewing && cred.file_url && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:50, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 16px", background:"#0d1117", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#fff", fontSize:13 }}>{cred.file_name ?? label}</span>
            <button onClick={() => setViewing(false)} style={{ color:"rgba(255,255,255,0.5)", background:"none", border:"none", cursor:"pointer", fontSize:20 }}>×</button>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            {cred.file_url.match(/\.(jpg|jpeg|png|webp)$/i)
              ? <img src={cred.file_url} alt={label} style={{ maxWidth:"90%", maxHeight:"80vh", borderRadius:8 }} />
              : <iframe src={cred.file_url} title={label} style={{ width:"90%", height:"80vh", borderRadius:8, border:"none", background:"#fff" }} />
            }
          </div>
        </div>
      )}

      <div style={{
        background: isApproved ? "rgba(34,197,94,0.04)" : isRejected ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isApproved ? "rgba(34,197,94,0.2)" : isRejected ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:8, padding:"12px 14px", display:"flex", alignItems:"center", gap:12
      }}>
        <div style={{ width:32, height:32, borderRadius:6, background: isApproved ? "rgba(34,197,94,0.15)" : isRejected ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <FileText size={14} color={isApproved ? "#22c55e" : isRejected ? "#ef4444" : "rgba(255,255,255,0.4)"} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.85)", fontWeight:500, margin:0 }}>{label}</p>
          <div style={{ display:"flex", gap:8, marginTop:3, alignItems:"center", flexWrap:"wrap" }}>
            {cred.file_name && <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{cred.file_name} {formatSize(cred.file_size) && `· ${formatSize(cred.file_size)}`}</span>}
            {cred.submitted_at && <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>Submitted {formatDate(cred.submitted_at)}</span>}
          </div>
          {isRejected && cred.rejection_reason && (
            <p style={{ fontSize:11, color:"rgba(239,68,68,0.7)", marginTop:4, margin:0 }}>Reason: {cred.rejection_reason}</p>
          )}
          {isApproved && cred.reviewed_by && (
            <p style={{ fontSize:11, color:"rgba(34,197,94,0.6)", marginTop:4, margin:0 }}>Approved by {cred.reviewed_by} · {formatDate(cred.reviewed_at)}</p>
          )}
        </div>

        <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, border:"1px solid", ...Object.fromEntries(statusColor(cred.status).split(" ").flatMap(c => {
            if (c.startsWith("text-")) return [];
            if (c.startsWith("bg-"))   return [];
            if (c.startsWith("border-")) return [];
            return [];
          })) }} className={statusColor(cred.status)}>
            {statusLabel(cred.status)}
          </span>

          {hasFile && (
            <button onClick={() => cred.file_url && window.open(cred.file_url, "_blank", "noopener,noreferrer")} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              <Eye size={11} /> View
            </button>
          )}
          {hasFile && cred.file_url && (
            <a href={cred.file_url} download target="_blank" rel="noreferrer" style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4, textDecoration:"none" }}>
              <Download size={11} /> Save
            </a>
          )}
          {!isApproved && hasFile && (
            <button onClick={approve} disabled={acting === "approve"}
              style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(34,197,94,0.3)", background:"rgba(34,197,94,0.1)", color:"#4ade80", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              {acting === "approve" ? <Loader2 size={11} style={{ animation:"spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
              Approve
            </button>
          )}
          {!isRejected && hasFile && (
            <button onClick={() => setShowReject(true)} disabled={!!acting}
              style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              <XCircle size={11} /> Reject
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add credential (agency adds a doc slot for a candidate) ────────────────────
const ADD_TYPES: { key: string; label: string }[] = [
  { key: "background_check",    label: "Background Check" },
  { key: "employee_evaluation", label: "Employee Evaluation" },
  { key: "reference_check",     label: "Reference Check" },
  { key: "i9_form",             label: "I-9 Form" },
  { key: "w4_form",             label: "W-4 Form" },
  { key: "offer_letter",        label: "Offer Letter" },
  { key: "skills_assessment",   label: "Skills Assessment" },
  { key: "__custom__",          label: "Custom\u2026" },
];

function AddCredential({ candidateId }: { candidateId: string }) {
  const [open, setOpen]     = useState(false);
  const [choice, setChoice] = useState("background_check");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function submit() {
    setErr("");
    const isCustom = choice === "__custom__";
    const label = isCustom ? custom.trim() : (ADD_TYPES.find(t => t.key === choice)?.label ?? choice);
    if (!label) { setErr("Enter a name."); return; }
    const docType = isCustom ? custom.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") : choice;
    if (!docType) { setErr("Enter a valid name."); return; }
    setSaving(true);
    try {
      // Derive tenant_id from an existing credential row for this candidate.
      const { data: existing, error: exErr } = await supabase
        .from("candidate_credentials")
        .select("tenant_id")
        .eq("candidate_id", candidateId)
        .limit(1)
        .maybeSingle();
      if (exErr || !existing?.tenant_id) { setErr("Could not resolve tenant."); setSaving(false); return; }
      const now = new Date().toISOString();
      const { error: insErr } = await supabase.from("candidate_credentials").insert({
        candidate_id: candidateId,
        tenant_id:    existing.tenant_id,
        doc_type:     docType,
        name:         label,
        status:       "pending",
        created_at:   now,
        updated_at:   now,
      });
      if (insErr) { setErr(insErr.message); setSaving(false); return; }
      // Realtime subscription will render the new row; reset the form.
      setOpen(false); setChoice("background_check"); setCustom(""); setSaving(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add."); setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ marginTop:4, padding:"8px 12px", borderRadius:8, border:"1px dashed rgba(129,140,248,0.4)", background:"transparent", color:"#818cf8", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, width:"fit-content" }}>
        + Add credential
      </button>
    );
  }

  return (
    <div style={{ marginTop:6, padding:12, borderRadius:8, border:"1px solid rgba(129,140,248,0.3)", background:"rgba(99,102,241,0.06)", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <select value={choice} onChange={e => setChoice(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:6, background:"#0d1117", color:"#fff", border:"1px solid rgba(255,255,255,0.15)", fontSize:13 }}>
          {ADD_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {choice === "__custom__" && (
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Credential name"
            style={{ padding:"7px 10px", borderRadius:6, background:"#0d1117", color:"#fff", border:"1px solid rgba(255,255,255,0.15)", fontSize:13, flex:1, minWidth:140 }} />
        )}
      </div>
      {err && <p style={{ fontSize:11, color:"#f87171", margin:0 }}>{err}</p>}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={submit} disabled={saving}
          style={{ padding:"7px 14px", borderRadius:6, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:500, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Adding\u2026" : "Add"}
        </button>
        <button onClick={() => { setOpen(false); setErr(""); }}
          style={{ padding:"7px 14px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Candidate row ─────────────────────────────────────────────────────────────
const CandidateRow = memo(function CandidateRow({ group, reviewer, onUpdate, expanded, onToggle }: {
  group:    CandidateGroup;
  reviewer: string;
  onUpdate: (cid: string, updated: Credential) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const approved = group.credentials.filter(c => c.status === "approved").length;
  const total    = group.credentials.length;

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
      <button onClick={onToggle}
        style={{ width:"100%", padding:"14px 16px", display:"flex", alignItems:"center", gap:12, background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
        <div style={{ width:36, height:36, borderRadius:8, background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <User size={16} color="#818cf8" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:14, color:"#fff", fontWeight:500, margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{group.candidate_name}</p>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", margin:0 }}>{group.candidate_email} · Submitted {formatDate(group.submitted_at)}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>{approved}/{total} docs</p>
            <div style={{ width:80, height:3, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:4 }}>
              <div style={{ width:`${total ? (approved/total)*100 : 0}%`, height:"100%", background:"#22c55e", borderRadius:2 }} />
            </div>
          </div>
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:20, border:"1px solid", whiteSpace:"nowrap" }}
            className={statusColor(group.status)}>{statusLabel(group.status)}</span>
          <ChevronDown size={14} color="rgba(255,255,255,0.3)" style={{ transform: expanded ? "rotate(180deg)" : "none", transition:"transform 0.2s" }} />
        </div>
      </button>

      {expanded && (
        <div style={{ padding:"0 16px 16px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
            {group.credentials.length === 0
              ? <p style={{ fontSize:13, color:"rgba(255,255,255,0.3)", textAlign:"center", padding:"20px 0" }}>No documents submitted yet.</p>
              : group.credentials.map(c => (
                  <CredentialCard key={c.id} cred={c} reviewer={reviewer}
                    onUpdate={updated => onUpdate(group.candidate_id, updated)} />
                ))
            }
            <AddCredential candidateId={group.candidate_id} />
          </div>
        </div>
      )}
    </div>
  );
});

// ── Main incoming page ────────────────────────────────────────────────────────
export default function ComplianceIncomingPage() {
  const [groups,   setGroups]   = useState<CandidateGroup[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all"|"pending"|"partial"|"complete"|"rejected">("all");
  const [reviewer, setReviewer] = useState("admin");
  const [lastRefresh, setLastRefresh] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((cid: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(cid) ? next.delete(cid) : next.add(cid);
      return next;
    });
  }, []);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total:    groups.length,
    complete: groups.filter(g => g.status === "complete").length,
    partial:  groups.filter(g => g.status === "partial").length,
    pending:  groups.filter(g => g.status === "pending").length,
    rejected: groups.filter(g => g.status === "rejected").length,
  };

  // ── Load data ────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch all credentials + join candidate_accounts
      const { data: creds, error } = await supabase
        .from("candidate_credentials")
        .select("*, candidate_accounts!candidate_id(full_name, email)")
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      // Group by candidate_id
      const map = new Map<string, CandidateGroup>();
      for (const c of (creds ?? [])) {
        const cid   = c.candidate_id ?? "unknown";
        const acct  = (c as any).candidate_accounts;
        const name  = acct?.full_name  ?? "Unknown Candidate";
        const email = acct?.email      ?? "";

        if (!map.has(cid)) {
          map.set(cid, {
            candidate_id:    cid,
            candidate_name:  name,
            candidate_email: email,
            credentials:     [],
            submitted_at:    c.submitted_at ?? c.updated_at ?? "",
            status:          "pending",
          });
        }
        map.get(cid)!.credentials.push(c as Credential);
      }

      // Compute status per group
      const result: CandidateGroup[] = [];
      for (const g of map.values()) {
        g.status = computeGroupStatus(g.credentials);
        g.submitted_at = g.credentials.reduce((latest, c) => {
          const t = c.submitted_at ?? "";
          return t > latest ? t : latest;
        }, "");
        result.push(g);
      }

      // Sort: pending first, then partial, then complete
      result.sort((a,b) => {
        const order = { pending:0, partial:1, rejected:2, complete:3 };
        return (order[a.status]??0) - (order[b.status]??0);
      });

      setGroups(result);
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load only. Manual refresh and realtime use silent load(true) so the
  // list never unmounts (which would collapse expanded folders).
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (lastRefresh > 0) load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lastRefresh]);

  // ── Realtime updates ─────────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel("compliance-incoming")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"candidate_credentials" },
        () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleUpdate = useCallback((candidateId: string, updated: Credential) => {
    setGroups(prev => prev.map(g => {
      if (g.candidate_id !== candidateId) return g;
      const creds = g.credentials.map(c => c.id === updated.id ? updated : c);
      return { ...g, credentials: creds, status: computeGroupStatus(creds) };
    }));
  }, []);

  const filtered = groups.filter(g => {
    const matchSearch = search === "" ||
      g.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
      g.candidate_email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || g.status === filter;
    return matchSearch && matchFilter;
  });

  const s = { fontSize:13, color:"rgba(255,255,255,0.6)", padding:"8px 14px", borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", cursor:"pointer" };
  const sa = { ...s, background:"rgba(255,255,255,0.06)", color:"#fff" };

  return (
    <div style={{ minHeight:"100vh", background:"#080810", color:"#fff", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Shield size={18} color="#818cf8" />
            <span style={{ fontSize:12, color:"#818cf8", letterSpacing:"0.15em", textTransform:"uppercase", fontWeight:500 }}>Compliance · Incoming Credentials</span>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
            <div>
              <h1 style={{ fontSize:24, fontWeight:600, margin:0 }}>Incoming Credentials</h1>
              <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13, margin:"4px 0 0" }}>Review candidate submissions · Approve or reject each document</p>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>Reviewing as</span>
              <input value={reviewer} onChange={e => setReviewer(e.target.value)}
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 10px", color:"#fff", fontSize:12, width:120, outline:"none" }} />
              <button onClick={() => setLastRefresh(Date.now())}
                style={{ padding:"8px 12px", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"rgba(255,255,255,0.5)", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:24 }}>
          {[
            { label:"Total", val:stats.total,    color:"#818cf8" },
            { label:"Complete", val:stats.complete, color:"#22c55e" },
            { label:"Partial",  val:stats.partial,  color:"#f59e0b" },
            { label:"Pending",  val:stats.pending,  color:"#94a3b8" },
            { label:"Rejected", val:stats.rejected, color:"#ef4444" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"14px 16px" }}>
              <p style={{ fontSize:22, fontWeight:300, color, margin:0 }}>{val}</p>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.1em", margin:"2px 0 0" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          <div style={{ flex:1, position:"relative" }}>
            <Search size={14} color="rgba(255,255,255,0.3)" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by candidate name or email..."
              style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"10px 12px 10px 36px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
          </div>
          {(["all","pending","partial","complete","rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={filter===f ? sa : s}>
              {f.charAt(0).toUpperCase()+f.slice(1)} {f!=="all" && `· ${stats[f as keyof typeof stats] ?? 0}`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <Loader2 size={24} color="#818cf8" style={{ animation:"spin 1s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.3)", fontSize:14 }}>
            {search || filter !== "all" ? "No candidates match your search." : "No candidate credentials submitted yet."}
          </div>
        ) : (
          filtered.map(g => (
            <CandidateRow key={g.candidate_id} group={g} reviewer={reviewer} onUpdate={handleUpdate} expanded={expandedRows.has(g.candidate_id)} onToggle={() => toggleRow(g.candidate_id)} />
          ))
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}