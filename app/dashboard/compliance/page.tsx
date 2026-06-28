"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase }          from "@/lib/supabase";
import { useTenant }         from "@/lib/hooks/useTenant";
import { FeatureGate }       from "@/app/components/FeatureGate";
import { getCurrentProfile } from "@/lib/profile/profile.service";
import {
  ShieldCheck, Search, Eye, CheckCircle2, XCircle,
  AlertTriangle, Clock, ZoomIn, ZoomOut, X, FileText,
  User, ChevronDown, ChevronUp, Loader2, RefreshCw,
  Folder, FolderOpen, ChevronRight, Plus, Upload,
  Download, Trash2, Edit2, Check, Save, File, Shield,
  ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════
type DocStatus = "pending"|"uploaded"|"approved"|"rejected";

interface CredentialDoc {
  id:               string;
  name:             string;
  doc_type:         string;
  file_url:         string|null;
  file_name:        string|null;
  status:           DocStatus;
  rejection_reason: string|null;
  reviewed_by_name: string|null;
  reviewed_by_id:   string|null;
  reviewed_at:      string|null;
  submitted_at:     string|null;
  updated_at:       string;
}

interface CandidateGroup {
  candidateId:   string;
  accountId:     string;
  candidateName: string;
  email:         string;
  submittedAt:   string;
  docs:          CredentialDoc[];
  overallStatus: "pending"|"partial"|"approved"|"rejected"|"complete";
}

interface AdminFolder {
  id: string; tenant_id: string; name: string;
  description: string|null; color: string|null;
  parent_id: string|null; sort_order: number;
  created_at: string; updated_at: string;
}

interface AdminFile {
  id: string; folder_id: string; tenant_id: string; name: string;
  file_url: string|null; file_name: string|null; file_size: number|null;
  file_type: string|null; version: number; status: "draft"|"active"|"archived";
  created_at: string; updated_at: string;
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
function fmtSize(b: number|null) {
  if (!b) return "";
  return b > 1024*1024 ? `${(b/1024/1024).toFixed(1)}MB` : `${(b/1024).toFixed(0)}KB`;
}
async function retry<T>(fn: () => Promise<T>, n = 3): Promise<T> {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch(e) { if (i===n-1) throw e; await new Promise(r=>setTimeout(r, 400*2**i)); }
  }
  throw new Error("Max retries");
}
function overall(docs: CredentialDoc[]): CandidateGroup["overallStatus"] {
  if (!docs.length) return "pending";
  if (docs.every(d=>d.status==="approved")) return "complete";
  if (docs.some(d=>d.status==="rejected"))  return "rejected";
  if (docs.some(d=>d.status==="approved"||d.status==="uploaded")) return "partial";
  return "pending";
}
const OS: Record<string,string> = {
  pending:  "bg-zinc-800 text-zinc-400 border-zinc-700",
  partial:  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  complete: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};
const DS: Record<DocStatus,string> = {
  pending:  "bg-zinc-800/50 text-zinc-500 border-zinc-700",
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};
const FC = ["#6366f1","#22c55e","#f59e0b","#ef4444","#ec4899","#14b8a6","#8b5cf6","#f97316"];

// ═══════════════════════════════════════════
// DOC VIEWER
// ═══════════════════════════════════════════
function DocViewer({ url, name, onClose }: { url:string; name:string; onClose:()=>void }) {
  const [zoom, setZoom] = useState(1);
  const isPdf = name.toLowerCase().endsWith(".pdf");
  useEffect(() => {
    const h = (e:KeyboardEvent) => { if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown",h); return () => window.removeEventListener("keydown",h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3"><FileText size={15} className="text-zinc-400"/><span className="text-sm text-white truncate max-w-xs">{name}</span></div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setZoom(z=>Math.max(0.5,z-.25))} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"><ZoomOut size={14} className="text-zinc-400"/></button>
          <span className="text-xs text-zinc-500 w-12 text-center">{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(3,z+.25))} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"><ZoomIn size={14} className="text-zinc-400"/></button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center ml-2"><X size={14} className="text-zinc-400"/></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        {isPdf ? <iframe src={url} style={{width:`${Math.min(900*zoom,1200)}px`,height:`${700*zoom}px`}} className="rounded-xl border border-zinc-800 shadow-2xl"/>
               : <img src={url} alt={name} className="rounded-xl border border-zinc-800 shadow-2xl object-contain" style={{maxWidth:`${900*zoom}px`,transform:`scale(${zoom})`,transformOrigin:"top center"}}/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// REJECT MODAL
// ═══════════════════════════════════════════
function RejectModal({ docName, onConfirm, onCancel }: { docName:string; onConfirm:(r:string)=>void; onCancel:()=>void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-zinc-800 bg-[#0f0f1a] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Reject Document</h3>
        <p className="text-xs text-zinc-500">Reason for rejecting <strong className="text-white">{docName}</strong>. Candidate will be notified.</p>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Document expired, image unclear..." rows={3}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition resize-none"/>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-sm text-zinc-400 hover:text-white transition">Cancel</button>
          <button onClick={()=>onConfirm(reason)} disabled={!reason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-40 transition">Confirm Reject</button>
        </div>
      </div>
    </div>
  );
}

// COMPLIANCE PAGE PATCH — drop these two components into app/dashboard/compliance/page.tsx
// replacing the existing CredRow and CandidateCard components

// ─────────────────────────────────────────
// CREDENTIAL ROW — stays open after OK/Reject
// ─────────────────────────────────────────
function CredRow({ doc, onApprove, onReject, updating }: {
  doc: CredentialDoc;
  onApprove: (id: string) => void;
  onReject:  (id: string, r: string) => void;
  updating:  string | null;
}) {
  const [viewing, setViewing] = useState(false);
  const [modal,   setModal]   = useState(false);
  const busy = updating === doc.id;

  return (
    <>
      {viewing && doc.file_url && (
        <DocViewer
          url={doc.file_url}
          name={doc.file_name ?? doc.name}
          onClose={() => setViewing(false)}
        />
      )}
      {modal && (
        <RejectModal
          docName={doc.name}
          onConfirm={r => { setModal(false); onReject(doc.id, r); }}
          onCancel={() => setModal(false)}
        />
      )}

      <div className={`rounded-xl border transition-colors ${DS[doc.status]}`}>
        {/* Top row — always visible */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
              ${doc.status === "approved" ? "bg-emerald-500/20" :
                doc.status === "rejected" ? "bg-red-500/20"     :
                doc.status === "uploaded" ? "bg-blue-500/20"    : "bg-zinc-800"}`}>
              <FileText size={12} className={
                doc.status === "approved" ? "text-emerald-400" :
                doc.status === "rejected" ? "text-red-400"     :
                doc.status === "uploaded" ? "text-blue-400"    : "text-zinc-600"} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{doc.name}</p>
              {doc.file_name && (
                <p className="text-[10px] text-zinc-600 truncate">{doc.file_name}</p>
              )}
              {doc.status === "rejected" && doc.rejection_reason && (
                <p className="text-[10px] text-red-400/80 mt-0.5">
                  Reason: {doc.rejection_reason}
                </p>
              )}
              {doc.status === "approved" && doc.reviewed_by_name && (
                <p className="text-[10px] text-emerald-400/70 mt-0.5">
                  ✔ {doc.reviewed_by_name} · {doc.reviewed_at ? fmt(doc.reviewed_at) : ""}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
            {/* View button — always show if file exists */}
            {doc.file_url ? (
              <button
                onClick={() => setViewing(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border
                           border-zinc-700 text-[11px] text-zinc-400
                           hover:text-white hover:border-zinc-600 transition"
              >
                <Eye size={11} /> View
              </button>
            ) : (
              <span className="text-[10px] text-zinc-700 px-2">No file</span>
            )}

            {/* OK — only if not already approved and file exists */}
            {doc.status !== "approved" && doc.file_url && (
              <button
                onClick={() => onApprove(doc.id)}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border
                           border-emerald-500/30 text-[11px] text-emerald-400
                           hover:bg-emerald-500/10 transition disabled:opacity-40"
              >
                {busy
                  ? <Loader2 size={10} className="animate-spin" />
                  : <CheckCircle2 size={11} />
                }
                OK
              </button>
            )}

            {/* Reject — only if not already rejected and file exists */}
            {doc.status !== "rejected" && doc.file_url && (
              <button
                onClick={() => setModal(true)}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border
                           border-red-500/30 text-[11px] text-red-400
                           hover:bg-red-500/10 transition disabled:opacity-40"
              >
                <XCircle size={11} /> Reject
              </button>
            )}

            {/* Status badges — shown after action */}
            {doc.status === "approved" && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 size={10} /> Approved
              </span>
            )}
            {doc.status === "rejected" && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <XCircle size={10} /> Rejected
              </span>
            )}
            {doc.status === "pending" && (
              <span className="text-[10px] text-zinc-600">Awaiting upload</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────
// CANDIDATE CARD — never collapses on doc update
// Uses useRef for expanded state to survive re-renders
// ─────────────────────────────────────────
function CandidateCard({ group, tenantId, recruiterName, recruiterId, onUpdate, expanded, onToggle }: {
  group:         CandidateGroup;
  tenantId:      string;
  recruiterName: string;
  recruiterId:   string;
  onUpdate:      (cId: string, dId: string, u: Partial<CredentialDoc>) => void;
  expanded:      boolean;
  onToggle:      () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const approved = group.docs.filter(d => d.status === "approved").length;
  const total    = group.docs.length;
  const pct      = total > 0 ? Math.round((approved / total) * 100) : 0;

  const approve = async (docId: string) => {
    setUpdating(docId);
    try {
      const now = new Date().toISOString();
      await retry(async () => {
        const { error } = await supabase
          .from("candidate_credentials")
          .update({
            status:           "approved",
            reviewed_by_name: recruiterName,
            reviewed_by_id:   recruiterId,
            reviewed_at:      now,
            rejection_reason: null,
            updated_at:       now,
          })
          .eq("id", docId);
        if (error) throw error;
      });

      const doc = group.docs.find(d => d.id === docId);
      if (doc) {
        await supabase.from("compliance_docs")
          .update({
            status:           "approved",
            reviewed_by_name: recruiterName,
            reviewed_by_id:   recruiterId,
            reviewed_at:      now,
            updated_at:       now,
          })
          .eq("candidate_id", group.candidateId)
          .eq("name", doc.name);
      }

      // Update local state — does NOT collapse the panel
      onUpdate(group.candidateId, docId, {
        status:           "approved",
        reviewed_by_name: recruiterName,
        reviewed_by_id:   recruiterId,
        reviewed_at:      now,
        rejection_reason: null,
      });
    } catch (e) {
      console.error("Approve failed:", e);
    } finally {
      setUpdating(null);
    }
  };

  const reject = async (docId: string, reason: string) => {
    setUpdating(docId);
    try {
      const now = new Date().toISOString();
      await retry(async () => {
        const { error } = await supabase
          .from("candidate_credentials")
          .update({
            status:           "rejected",
            rejection_reason: reason,
            reviewed_by_name: recruiterName,
            reviewed_by_id:   recruiterId,
            reviewed_at:      now,
            updated_at:       now,
          })
          .eq("id", docId);
        if (error) throw error;
      });

      const doc = group.docs.find(d => d.id === docId);
      if (doc) {
        await supabase.from("compliance_docs")
          .update({
            status:           "expired",
            rejection_reason: reason,
            reviewed_by_name: recruiterName,
            reviewed_by_id:   recruiterId,
            reviewed_at:      now,
            updated_at:       now,
          })
          .eq("candidate_id", group.candidateId)
          .eq("name", doc.name);

        // Xavier notification
        await supabase.from("xavier_notifications").insert({
          tenant_id:    tenantId,
          candidate_id: group.candidateId,
          stage:        "manual_review",
          message:      `⚠ Xavier AI · Document rejected for ${group.candidateName}: "${doc.name}". Reason: ${reason}.`,
          type:         "alert",
          read:         false,
          created_at:   now,
        });
      }

      // Update local state — does NOT collapse the panel
      onUpdate(group.candidateId, docId, {
        status:           "rejected",
        rejection_reason: reason,
        reviewed_by_name: recruiterName,
        reviewed_by_id:   recruiterId,
        reviewed_at:      now,
      });
    } catch (e) {
      console.error("Reject failed:", e);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className={`rounded-2xl border transition-colors
      ${group.overallStatus === "complete" ? "border-emerald-500/20 bg-emerald-500/[0.02]" :
        group.overallStatus === "rejected"  ? "border-red-500/20 bg-red-500/[0.02]"         :
                                              "border-zinc-800 bg-zinc-900"}`}>

      {/* Header row — click to toggle */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition rounded-2xl"
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300
                        flex items-center justify-center font-bold text-sm flex-shrink-0">
          {group.candidateName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{group.candidateName}</p>
          <p className="text-xs text-zinc-500 truncate">{group.email}</p>
        </div>
        <div className="hidden md:block w-32">
          <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
            <span>{approved}/{total} docs</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize ${OS[group.overallStatus]}`}>
          {group.overallStatus === "complete" ? "✔ Complete" : group.overallStatus}
        </span>
        <div className="text-zinc-600 flex-shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded credentials — stays open during OK/Reject actions */}
      {expanded && (
        <div className="px-5 pb-5 space-y-2 border-t border-zinc-800 pt-4">
          {group.submittedAt && (
            <p className="text-[10px] text-zinc-600 mb-3">
              Submitted: {fmt(group.submittedAt)}
            </p>
          )}
          {group.docs.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">
              No documents submitted yet.
            </p>
          ) : (
            group.docs.map(doc => (
              <CredRow
                key={doc.id}
                doc={doc}
                onApprove={approve}
                onReject={reject}
                updating={updating}
              />
            ))
          )}
          {group.overallStatus === "complete" && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl
                            bg-emerald-500/10 border border-emerald-500/20 mt-3">
              <ShieldCheck size={15} className="text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">
                  All credentials approved
                </p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">
                  Reviewed by {group.docs.find(d => d.reviewed_by_name)?.reviewed_by_name ?? recruiterName}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// ADMIN FILE ROW
// ═══════════════════════════════════════════
function AdminFileRow({ file, folderId, tenantId, onUpdate, onDelete }: {
  file:AdminFile; folderId:string; tenantId:string;
  onUpdate:(f:AdminFile)=>void; onDelete:(id:string)=>void;
}) {
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState(file.name);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [viewing,   setViewing]   = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    if (!name.trim()||name===file.name) { setEditing(false); return; }
    setSaving(true);
    await retry(async () => {
      const { data, error } = await supabase.from("admin_doc_files").update({ name:name.trim(), updated_at:new Date().toISOString() }).eq("id",file.id).select().single();
      if (error) throw error; onUpdate(data as AdminFile);
    });
    setSaving(false); setEditing(false);
  };

  const upload = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const ext  = f.name.split(".").pop();
      const path = `${tenantId}/${folderId}/${file.id}_v${file.version+1}.${ext}`;
      await retry(async () => { const { error } = await supabase.storage.from("admin-documents").upload(path,f,{upsert:true}); if (error) throw error; });
      const { data:u } = supabase.storage.from("admin-documents").getPublicUrl(path);
      const { data, error } = await supabase.from("admin_doc_files").update({ file_url:u.publicUrl, file_name:f.name, file_size:f.size, file_type:f.type, version:file.version+1, status:"active", updated_at:new Date().toISOString() }).eq("id",file.id).select().single();
      if (error) throw error; onUpdate(data as AdminFile);
    } catch(e) { console.error("Upload error:",e); }
    finally { setUploading(false); e.target.value=""; }
  };

  const del = async () => {
    await retry(async () => { const { error } = await supabase.from("admin_doc_files").delete().eq("id",file.id); if (error) throw error; });
    onDelete(file.id);
  };

  const sc = file.status==="active"?"text-emerald-400":file.status==="archived"?"text-zinc-500":"text-amber-400";
  return (
    <>
      {viewing && file.file_url && <DocViewer url={file.file_url} name={file.file_name??file.name} onClose={()=>setViewing(false)}/>}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900 rounded-lg border border-zinc-800 mb-1.5">
        <File size={13} className="text-zinc-600 flex-shrink-0"/>
        {editing ? (
          <div className="flex-1 flex gap-2">
            <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditing(false);}} autoFocus className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white outline-none"/>
            <button onClick={saveName} disabled={saving} className="text-emerald-400">{saving?<Loader2 size={13} className="animate-spin"/>:<Check size={13}/>}</button>
            <button onClick={()=>setEditing(false)} className="text-zinc-600"><X size={13}/></button>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <span className="text-sm text-zinc-300">{file.name}</span>
            <span className={`text-[10px] ml-2 ${sc}`}>v{file.version} · {file.status}</span>
            {file.file_name && <span className="text-[10px] text-zinc-600 ml-2">{file.file_name} {fmtSize(file.file_size)&&`· ${fmtSize(file.file_size)}`}</span>}
          </div>
        )}
        <div className="flex gap-1 flex-shrink-0">
          {file.file_url && <button onClick={()=>setViewing(true)} className="p-1.5 rounded border border-zinc-700 text-zinc-500 hover:text-white transition"><Eye size={11}/></button>}
          {file.file_url && <a href={file.file_url} download target="_blank" rel="noreferrer" className="p-1.5 rounded border border-zinc-700 text-zinc-500 hover:text-white transition flex items-center"><Download size={11}/></a>}
          <button onClick={()=>ref.current?.click()} disabled={uploading} className="flex items-center gap-1 px-2 py-1 rounded border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-[11px] transition">
            {uploading?<Loader2 size={11} className="animate-spin"/>:<Upload size={11}/>}{file.file_url?"Replace":"Upload"}
          </button>
          <button onClick={()=>setEditing(true)} className="p-1.5 rounded border border-zinc-700 text-zinc-500 hover:text-white transition"><Edit2 size={11}/></button>
          <button onClick={del} className="p-1.5 rounded border border-red-500/20 text-red-500/60 hover:text-red-400 transition"><Trash2 size={11}/></button>
        </div>
        <input ref={ref} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx" onChange={upload}/>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// FOLDER PANEL
// ═══════════════════════════════════════════
function FolderPanel({ folder, allFolders, fileMap, depth, tenantId, onFU, onFD, onAF, onAD, onFileU, onFileD }: {
  folder:AdminFolder; allFolders:AdminFolder[]; fileMap:Record<string,AdminFile[]>;
  depth:number; tenantId:string;
  onFU:(f:AdminFolder)=>void; onFD:(id:string)=>void;
  onAF:(fId:string,f:AdminFile)=>void; onAD:(f:AdminFolder)=>void;
  onFileU:(fId:string,f:AdminFile)=>void; onFileD:(fId:string,fid:string)=>void;
}) {
  const [open,    setOpen]    = useState(depth===0);
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(folder.name);
  const [saving,  setSaving]  = useState(false);
  const [addFile, setAddFile] = useState(false);
  const [fname,   setFname]   = useState("");
  const [sfFile,  setSfFile]  = useState(false);
  const [addDir,  setAddDir]  = useState(false);
  const [dname,   setDname]   = useState("");
  const [sfDir,   setSfDir]   = useState(false);
  const [cp,      setCp]      = useState(false);

  const color    = folder.color ?? "#6366f1";
  const children = allFolders.filter(f=>f.parent_id===folder.id);
  const files    = fileMap[folder.id] ?? [];
  const pl       = depth*20;

  const saveName = async () => {
    if (!name.trim()||name===folder.name) { setEditing(false); return; }
    setSaving(true);
    await retry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders").update({ name:name.trim(), updated_at:new Date().toISOString() }).eq("id",folder.id).select().single();
      if (error) throw error; onFU(data as AdminFolder);
    });
    setSaving(false); setEditing(false);
  };

  const addFileAction = async () => {
    if (!fname.trim()) return; setSfFile(true);
    await retry(async () => {
      const { data, error } = await supabase.from("admin_doc_files").insert({ folder_id:folder.id, tenant_id:tenantId, name:fname.trim(), status:"draft", version:1, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select().single();
      if (error) throw error; onAF(folder.id, data as AdminFile);
    });
    setSfFile(false); setFname(""); setAddFile(false);
  };

  const addDirAction = async () => {
    if (!dname.trim()) return; setSfDir(true);
    await retry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders").insert({ tenant_id:tenantId, name:dname.trim(), parent_id:folder.id, color, sort_order:children.length, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select().single();
      if (error) throw error; onAD(data as AdminFolder);
    });
    setSfDir(false); setDname(""); setAddDir(false);
  };

  const delFolder = async () => {
    if (!confirm(`Delete "${folder.name}" and all contents?`)) return;
    await retry(async () => { const { error } = await supabase.from("admin_doc_folders").delete().eq("id",folder.id); if (error) throw error; });
    onFD(folder.id);
  };

  return (
    <div className={depth===0?"mb-2":"mb-1"}>
      <div className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border cursor-pointer transition-colors ${open?"bg-white/[0.03] border-zinc-700":"bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"}`}
        style={{paddingLeft:pl+12}} onClick={()=>setOpen(o=>!o)}>
        <ChevronRight size={13} className="text-zinc-600 flex-shrink-0 transition-transform" style={{transform:open?"rotate(90deg)":"none"}}/>
        {open?<FolderOpen size={15} style={{color,flexShrink:0}}/>:<Folder size={15} style={{color,flexShrink:0}}/>}
        {editing ? (
          <div className="flex-1 flex gap-2" onClick={e=>e.stopPropagation()}>
            <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditing(false);}} autoFocus className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-white outline-none"/>
            <button onClick={saveName} disabled={saving} className="text-emerald-400">{saving?<Loader2 size={12} className="animate-spin"/>:<Check size={12}/>}</button>
            <button onClick={()=>setEditing(false)} className="text-zinc-600"><X size={12}/></button>
          </div>
        ) : <span className="flex-1 text-sm font-medium text-zinc-200">{folder.name}</span>}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
          <span className="text-[10px] text-zinc-600 mr-1">{files.length}f · {children.length}d</span>
          <div className="relative">
            <button onClick={()=>setCp(c=>!c)} className="w-3.5 h-3.5 rounded-full border border-white/20" style={{background:color}}/>
            {cp && (
              <div className="absolute top-6 right-0 bg-zinc-900 border border-zinc-700 rounded-lg p-2 flex gap-1.5 flex-wrap w-24 z-20 shadow-xl">
                {FC.map(c=>(
                  <button key={c} onClick={async()=>{ await supabase.from("admin_doc_folders").update({color:c}).eq("id",folder.id); onFU({...folder,color:c}); setCp(false); }} className="w-5 h-5 rounded-full" style={{background:c,outline:c===color?"2px solid white":"none"}}/>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>{setEditing(true);setOpen(true);}} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-800"><Edit2 size={11}/></button>
          <button onClick={()=>{setAddFile(true);setOpen(true);}} className="p-1 rounded text-indigo-400 hover:bg-indigo-500/10" title="Add file"><Plus size={11}/></button>
          <button onClick={()=>{setAddDir(true);setOpen(true);}} className="p-1 rounded text-indigo-400 hover:bg-indigo-500/10" title="Add subfolder"><Folder size={11}/></button>
          <button onClick={delFolder} className="p-1 rounded text-red-500/50 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={11}/></button>
        </div>
      </div>
      {open && (
        <div style={{paddingLeft:pl+28}} className="mt-1">
          {files.map(f=><AdminFileRow key={f.id} file={f} folderId={folder.id} tenantId={tenantId} onUpdate={u=>onFileU(folder.id,u)} onDelete={id=>onFileD(folder.id,id)}/>)}
          {addFile && (
            <div className="flex gap-2 mb-2">
              <input value={fname} onChange={e=>setFname(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addFileAction();if(e.key==="Escape")setAddFile(false);}} placeholder="File name..." autoFocus className="flex-1 bg-zinc-800 border border-indigo-500/40 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-zinc-600"/>
              <button onClick={addFileAction} disabled={!fname.trim()||sfFile} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40">{sfFile?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Save</button>
              <button onClick={()=>setAddFile(false)} className="px-2 rounded-lg border border-zinc-700 text-zinc-500"><X size={13}/></button>
            </div>
          )}
          {children.map(c=><FolderPanel key={c.id} folder={c} allFolders={allFolders} fileMap={fileMap} depth={depth+1} tenantId={tenantId} onFU={onFU} onFD={onFD} onAF={onAF} onAD={onAD} onFileU={onFileU} onFileD={onFileD}/>)}
          {addDir && (
            <div className="flex gap-2 mt-1 mb-2">
              <input value={dname} onChange={e=>setDname(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addDirAction();if(e.key==="Escape")setAddDir(false);}} placeholder="Subfolder name..." autoFocus className="flex-1 bg-zinc-800 border border-indigo-500/40 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder-zinc-600"/>
              <button onClick={addDirAction} disabled={!dname.trim()||sfDir} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40">{sfDir?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} Save</button>
              <button onClick={()=>setAddDir(false)} className="px-2 rounded-lg border border-zinc-700 text-zinc-500"><X size={13}/></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// INCOMING TAB
// ═══════════════════════════════════════════
function IncomingTab({ tenantId, recruiterName, recruiterId }: { tenantId:string; recruiterName:string; recruiterId:string }) {
  const [groups,  setGroups]  = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data:creds }, { data:accs }] = await Promise.all([
        supabase.from("candidate_credentials").select("*").eq("tenant_id",tenantId).order("updated_at",{ascending:false}),
        supabase.from("candidate_accounts").select("*").eq("tenant_id",tenantId),
      ]);
      const am: Record<string,any> = {};
      (accs??[]).forEach(a => { am[a.candidate_id??a.id]=a; });
      const gm: Record<string,CredentialDoc[]> = {};
      (creds??[]).forEach(c => {
        const k = c.candidate_id??c.candidate_account_id??"unknown";
        if (!gm[k]) gm[k]=[];
        gm[k].push(c as CredentialDoc);
      });
      const result: CandidateGroup[] = Object.entries(gm).map(([cId,docs]) => {
        const a = am[cId];
        const latest = docs.reduce((l,d) => d.submitted_at&&d.submitted_at>l?d.submitted_at:l,"");
        return { candidateId:cId, accountId:a?.id??cId, candidateName:a?.full_name??"Unknown Candidate", email:a?.email??"", submittedAt:latest, docs, overallStatus:overall(docs) };
      });
      result.sort((a,b) => {
        const o:Record<string,number>={pending:0,partial:1,rejected:2,approved:3,complete:4};
        return (o[a.overallStatus]??0)-(o[b.overallStatus]??0);
      });
      setGroups(result);
    } catch(e) { console.error("Load error:",e); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("incoming-live").on("postgres_changes",{event:"*",schema:"public",table:"candidate_credentials"},()=>load(true)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const onUpdate = useCallback((cId:string, dId:string, u:Partial<CredentialDoc>) => {
    setGroups(prev => prev.map(g => {
      if (g.candidateId!==cId) return g;
      const docs = g.docs.map(d=>d.id===dId?{...d,...u} as CredentialDoc:d);
      return {...g, docs, overallStatus:overall(docs)};
    }));
  }, []);

  const counts: Record<string,number> = { all:groups.length, pending:groups.filter(g=>g.overallStatus==="pending").length, partial:groups.filter(g=>g.overallStatus==="partial").length, complete:groups.filter(g=>g.overallStatus==="complete").length, rejected:groups.filter(g=>g.overallStatus==="rejected").length, approved:groups.filter(g=>g.overallStatus==="approved").length };
  const visible = groups.filter(g => {
    const ms = !search||g.candidateName.toLowerCase().includes(search.toLowerCase())||g.email.toLowerCase().includes(search.toLowerCase());
    return ms && (filter==="all"||g.overallStatus===filter);
  });

  if (loading) return <div className="flex items-center justify-center h-48 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/> Loading credentials...</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{key:"complete",label:"Complete",icon:ShieldCheck,color:"text-emerald-400"},{key:"partial",label:"In Review",icon:Clock,color:"text-blue-400"},{key:"rejected",label:"Has Rejects",icon:AlertTriangle,color:"text-red-400"},{key:"pending",label:"Pending",icon:Clock,color:"text-zinc-400"}].map(({key,label,icon:Icon,color})=>(
          <div key={key} onClick={()=>setFilter(key as any)} className={`rounded-xl border p-4 cursor-pointer transition-colors ${filter===key?"border-white/20 bg-white/[0.06]":"border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
            <Icon size={15} className={`mb-2 ${color}`}/>
            <p className={`text-2xl font-bold ${color}`}>{counts[key] ?? 0}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
          <Search size={14} className="text-zinc-600 flex-shrink-0"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by candidate name or email..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"/>
          {search && <button onClick={()=>setSearch("")} className="text-zinc-600 hover:text-white"><X size={14}/></button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all","pending","partial","complete","rejected"] as string[]).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${filter===f?"bg-white/10 text-white border border-white/20":"text-zinc-500 hover:text-zinc-300 border border-transparent"}`}>
              {f} <span className="text-zinc-600 ml-1">{counts[f as string] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <User size={11}/>
        <span>Reviewing as <span className="text-zinc-400 font-medium">{recruiterName}</span> — approvals stamped with your name, date and time.</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{visible.length} candidate{visible.length!==1?"s":""} shown</span>
        <button onClick={()=>load()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:text-white hover:border-zinc-700 transition"><RefreshCw size={11}/> Refresh</button>
      </div>
      {visible.length===0
        ? <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600">{search?`No candidates match "${search}"`:"No candidate credentials submitted yet."}</div>
        : <div className="space-y-3">{visible.map(g=><CandidateCard key={g.candidateId} group={g} tenantId={tenantId} recruiterName={recruiterName} recruiterId={recruiterId} onUpdate={onUpdate} expanded={expandedIds.has(g.candidateId)} onToggle={()=>toggleExpanded(g.candidateId)}/>)}</div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════
// OUTGOING TAB
// ═══════════════════════════════════════════
function OutgoingTab({ tenantId }: { tenantId:string }) {
  const [folders,  setFolders]  = useState<AdminFolder[]>([]);
  const [fileMap,  setFileMap]  = useState<Record<string,AdminFile[]>>({});
  const [loading,  setLoading]  = useState(true);
  const [addRoot,  setAddRoot]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<string|null>(null);

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [{ data:fd },{ data:fd2 }] = await Promise.all([
        supabase.from("admin_doc_folders").select("*").eq("tenant_id",tenantId).order("sort_order"),
        supabase.from("admin_doc_files").select("*").eq("tenant_id",tenantId).order("created_at"),
      ]);
      setFolders((fd??[]) as AdminFolder[]);
      const fm:Record<string,AdminFile[]>={};
      for (const f of (fd2??[]) as AdminFile[]) { if (!fm[f.folder_id]) fm[f.folder_id]=[]; fm[f.folder_id].push(f); }
      setFileMap(fm);
    } catch(e) { console.error("Load error:",e); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("admin-docs-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"admin_doc_folders"},()=>load())
      .on("postgres_changes",{event:"*",schema:"public",table:"admin_doc_files"},  ()=>load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const addRootFolder = async () => {
    if (!newName.trim()) return; setSaving(true);
    await retry(async () => {
      const { data, error } = await supabase.from("admin_doc_folders").insert({ tenant_id:tenantId, name:newName.trim(), parent_id:null, sort_order:folders.filter(f=>!f.parent_id).length, color:"#6366f1", created_at:new Date().toISOString(), updated_at:new Date().toISOString() }).select().single();
      if (error) throw error; setFolders(p=>[...p,data as AdminFolder]); showToast(`Folder "${newName.trim()}" created`);
    });
    setSaving(false); setNewName(""); setAddRoot(false);
  };

  const roots = folders.filter(f=>!f.parent_id);
  const totalFiles  = Object.values(fileMap).reduce((a,b)=>a+b.length,0);
  const activeFiles = Object.values(fileMap).flat().filter(f=>f.status==="active").length;

  if (loading) return <div className="flex items-center justify-center h-48 text-zinc-500 gap-2"><Loader2 size={16} className="animate-spin"/> Loading...</div>;

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm shadow-xl"><Check size={13}/>{toast}</div>}
      <div className="grid grid-cols-4 gap-3">
        {[{label:"Folders",val:folders.length,color:"text-indigo-400"},{label:"Root Folders",val:roots.length,color:"text-indigo-400"},{label:"Total Files",val:totalFiles,color:"text-amber-400"},{label:"Active Files",val:activeFiles,color:"text-emerald-400"}].map(({label,val,color})=>(
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-zinc-600">All changes save automatically · Click + to add files or subfolders</p>
        <button onClick={()=>setAddRoot(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"><Plus size={14}/> New Folder</button>
      </div>
      {addRoot && (
        <div className="flex gap-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
          <Folder size={16} className="text-indigo-400 mt-2.5 flex-shrink-0"/>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addRootFolder();if(e.key==="Escape")setAddRoot(false);}} placeholder="Folder name..." autoFocus className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none placeholder-zinc-600"/>
          <button onClick={addRootFolder} disabled={!newName.trim()||saving} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40">{saving?<Loader2 size={13} className="animate-spin"/>:<Save size={13}/>} Create</button>
          <button onClick={()=>setAddRoot(false)} className="px-3 py-2.5 rounded-lg border border-zinc-700 text-zinc-500 hover:text-white"><X size={14}/></button>
        </div>
      )}
      {roots.length===0
        ? <div className="border border-dashed border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-600"><Folder size={28} className="mx-auto mb-3 opacity-30"/>No folders yet. Create one above.<br/><span className="text-xs text-zinc-700 mt-1 block">New Hire Packets folder should appear if the SQL seed ran correctly.</span></div>
        : roots.map(f=>(
            <FolderPanel key={f.id} folder={f} allFolders={folders} fileMap={fileMap} depth={0} tenantId={tenantId}
              onFU={u=>setFolders(p=>p.map(x=>x.id===u.id?u:x))}
              onFD={id=>setFolders(p=>p.filter(x=>x.id!==id))}
              onAF={(fId,file)=>setFileMap(p=>({...p,[fId]:[...(p[fId]??[]),file]}))}
              onAD={f=>setFolders(p=>[...p,f])}
              onFileU={(fId,file)=>setFileMap(p=>({...p,[fId]:(p[fId]??[]).map(x=>x.id===file.id?file:x)}))}
              onFileD={(fId,fid)=>setFileMap(p=>({...p,[fId]:(p[fId]??[]).filter(x=>x.id!==fid)}))}/>
          ))
      }
      <p className="text-xs text-zinc-700 text-center pt-2">All changes save automatically · Powered by PivotOps</p>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function CompliancePage() {
  const { tenantId, loading:tenantLoading } = useTenant();
  const [tab,           setTab]           = useState<"incoming"|"outgoing">("incoming");
  const [recruiterName, setRecruiterName] = useState("Recruiter");
  const [recruiterId,   setRecruiterId]   = useState("");

  useEffect(() => {
    getCurrentProfile().then(p => {
      if (p) { setRecruiterName(p.full_name??p.email??"Recruiter"); setRecruiterId(p.id); }
    });
  }, []);

  if (tenantLoading) return (
    <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2">
      <Loader2 size={16} className="animate-spin"/> Loading compliance...
    </div>
  );

  return (
    <FeatureGate tenantId={tenantId} feature="compliance" title="Compliance">
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance</h1>
        <p className="text-zinc-400 text-sm mt-1">Incoming credentials · Admin Docs Console</p>
      </div>
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        <button onClick={()=>setTab("incoming")} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab==="incoming"?"bg-white/10 text-white shadow-sm":"text-zinc-500 hover:text-zinc-300"}`}>
          <ArrowDownToLine size={14}/> Incoming Credentials
        </button>
        <button onClick={()=>setTab("outgoing")} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab==="outgoing"?"bg-white/10 text-white shadow-sm":"text-zinc-500 hover:text-zinc-300"}`}>
          <ArrowUpFromLine size={14}/> Admin Docs Console
        </button>
      </div>
      {tab==="incoming"
        ? <IncomingTab tenantId={tenantId} recruiterName={recruiterName} recruiterId={recruiterId}/>
        : <OutgoingTab tenantId={tenantId}/>
      }
    </div>
    </FeatureGate>
  );
}