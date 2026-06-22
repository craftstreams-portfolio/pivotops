"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Upload, Eye, CheckCircle2, XCircle,
  Brain, Loader2, AlertCircle, ZoomIn,
  ZoomOut, X, FileText, Shield, LogOut, Plus,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

// Full healthcare compliance set — unchanged from before.
const HEALTHCARE_CREDENTIAL_TYPES = [
  { key: "resume", label: "Resume / CV", required: true },
  { key: "nursing_license", label: "Nursing License", required: true },
  { key: "drivers_license", label: "Driver's License", required: true },
  { key: "flu_shot", label: "Flu Shot Record", required: true },
  { key: "covid_vaccine", label: "COVID-19 Vaccination", required: true },
  { key: "hep_b", label: "Hepatitis B Record", required: true },
  { key: "mmr", label: "MMR Vaccination", required: true },
  { key: "chest_xray", label: "Chest X-Ray", required: true },
  { key: "bls_cpr", label: "BLS / CPR Certification", required: true },
  { key: "drug_screening", label: "Drug Screening Results", required: true },
  { key: "background_check", label: "Background Check", required: true },
];

// Lightweight default set for non-healthcare roles. The "+" control lets
// the candidate add more upload slots with their own labels on the fly.
const GENERAL_CREDENTIAL_TYPES = [
  { key: "resume", label: "Resume / CV", required: true },
  { key: "license_certification", label: "License / Certification", required: true },
];

interface Credential {
  id: string;
  doc_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  status: "pending" | "uploaded" | "approved" | "rejected";
  rejection_reason: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  name?: string | null;
}

interface CandidateAccount {
  id: string;
  full_name: string;
  email: string;
  ssn_last4: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  role: string | null;
  candidate_id: string | null;
  tenant_id: string;
}

type CredentialType = { key: string; label: string; required: boolean };

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 400): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

// ── Document Viewer ───────────────────────────────────────────────────────────
function DocViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const isPdf = name.toLowerCase().endsWith(".pdf") || url.includes(".pdf");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <FileText size={15} className="text-zinc-400" />
          <span className="text-sm text-white truncate max-w-xs">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition"><ZoomOut size={14} className="text-zinc-400" /></button>
          <span className="text-xs text-zinc-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition"><ZoomIn size={14} className="text-zinc-400" /></button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center ml-2 transition"><X size={14} className="text-zinc-400" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        {isPdf
          ? <iframe src={url} title={name} className="rounded-xl border border-zinc-800 shadow-2xl bg-white" style={{ width: `${Math.min(900 * zoom, 1200)}px`, height: `${700 * zoom}px` }} />
          : <img src={url} alt={name} className="rounded-xl border border-zinc-800 shadow-2xl object-contain" style={{ maxWidth: `${900 * zoom}px`, transform: `scale(${zoom})`, transformOrigin: "top center" }} />
        }
      </div>
    </div>
  );
}

// ── Credential Row ────────────────────────────────────────────────────────────
function CredentialRow({ type, credential, accountId, candidateId, tenantId, onUpdate, removable, onRemove }: {
  type: CredentialType;
  credential: Credential | null;
  accountId: string;
  candidateId: string;
  tenantId: string;
  onUpdate: (cred: Credential) => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const status = credential?.status ?? "pending";

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadErr(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadErr("File type not allowed. Use PDF, JPG, PNG, or Word document.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadErr(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${tenantId}/${candidateId}/${type.key}_${Date.now()}.${ext}`;

      setProgress(30);

      await withRetry(async () => {
        const { error: upErr } = await supabase.storage
          .from("credentials")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw new Error(upErr.message);
      });

      setProgress(70);

      const { data: urlData } = supabase.storage.from("credentials").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const record = {
        candidate_account_id: accountId,
        candidate_id: candidateId,
        tenant_id: tenantId,
        doc_type: type.key,
        name: type.label,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        status: "uploaded" as const,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setProgress(85);

      const result = await withRetry(async () => {
        if (credential?.id) {
          const { data, error } = await supabase
            .from("candidate_credentials")
            .update(record)
            .eq("id", credential.id)
            .select()
            .single();
          if (error) throw new Error(error.message);
          return data;
        } else {
          const { data, error } = await supabase
            .from("candidate_credentials")
            .insert({ ...record, created_at: new Date().toISOString() })
            .select()
            .single();
          if (error) throw new Error(error.message);
          return data;
        }
      });

      setProgress(100);
      onUpdate(result as Credential);
      setTimeout(() => setProgress(0), 1000);

    } catch (err) {
      console.error("Upload failed:", err);
      setUploadErr(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setProgress(0);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [credential, accountId, candidateId, tenantId, type.key, type.label, onUpdate]);

  const statusColors: Record<string, string> = {
    pending: "border-zinc-800 bg-zinc-900",
    uploaded: "border-blue-500/20 bg-blue-500/5",
    approved: "border-emerald-500/20 bg-emerald-500/5",
    rejected: "border-red-500/20 bg-red-500/5",
  };

  const statusBadge: Record<string, React.ReactNode> = {
    pending: <span className="text-[10px] text-zinc-600">Not uploaded</span>,
    uploaded: <span className="text-[10px] text-blue-400 font-medium">Under Review</span>,
    approved: <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium"><CheckCircle2 size={10} />Approved</span>,
    rejected: <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium"><XCircle size={10} />Rejected</span>,
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
  };

  return (
    <>
      {viewing && credential?.file_url && (
        <DocViewer url={credential.file_url} name={credential.file_name ?? type.label} onClose={() => setViewing(false)} />
      )}
      <div className={`rounded-xl border p-4 transition-colors ${statusColors[status]}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
              ${status === "approved" ? "bg-emerald-500/15" : status === "rejected" ? "bg-red-500/15" : status === "uploaded" ? "bg-blue-500/15" : "bg-zinc-800"}`}>
              <FileText size={14} className={status === "approved" ? "text-emerald-400" : status === "rejected" ? "text-red-400" : status === "uploaded" ? "text-blue-400" : "text-zinc-600"} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {type.label}{type.required && <span className="text-red-400 ml-1 text-xs">*</span>}
              </p>
              <div className="mt-0.5">{statusBadge[status]}</div>
              {status === "rejected" && credential?.rejection_reason && (
                <p className="text-[10px] text-red-400/70 mt-0.5">Reason: {credential.rejection_reason}</p>
              )}
              {credential?.file_name && status !== "rejected" && (
                <p className="text-[10px] text-zinc-600 mt-0.5 truncate">
                  {credential.file_name} {credential.file_size ? `· ${formatSize(credential.file_size)}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {credential?.file_url && (
              <button onClick={() => credential?.file_url && window.open(credential.file_url, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition">
                <Eye size={12} /> View
              </button>
            )}
            <button onClick={() => fileRef.current?.click()}
              disabled={uploading || status === "approved"}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40
                ${status === "approved" ? "border border-emerald-500/20 text-emerald-400 cursor-not-allowed" :
                  status === "rejected" ? "bg-indigo-600 hover:bg-indigo-500 text-white" :
                  "border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"}`}>
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {status === "approved" ? "✓ Approved" : status === "rejected" ? "Re-upload" : credential ? "Replace" : "Upload"}
            </button>
            {removable && status === "pending" && (
              <button onClick={onRemove}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 transition">
                <X size={12} />
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={handleUpload} />
          </div>
        </div>

        {uploading && progress > 0 && (
          <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {uploadErr && (
          <p className="mt-2 text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5">{uploadErr}</p>
        )}
      </div>
    </>
  );
}

// ── Main Portal ───────────────────────────────────────────────────────────────
function CandidatePortalPage({ candidateId, tenantId }: { candidateId: string; tenantId: string }) {
  const [account, setAccount] = useState<CandidateAccount | null>(null);
  const [roleCategory, setRoleCategory] = useState<"healthcare" | "general">("healthcare");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);

  const baseTypes: CredentialType[] = roleCategory === "general" ? GENERAL_CREDENTIAL_TYPES : HEALTHCARE_CREDENTIAL_TYPES;
  const baseKeys = new Set(baseTypes.map(t => t.key));
  const dynamicTypes: CredentialType[] = credentials
    .filter(c => !baseKeys.has(c.doc_type))
    .map(c => ({ key: c.doc_type, label: c.name || c.doc_type, required: false }));
  const effectiveTypes: CredentialType[] = [...baseTypes, ...dynamicTypes];

  // ── Load account + role_category + credentials ────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!candidateId) { setError("Invalid portal link."); setLoading(false); return; }

      try {
        const { data: accs, error: accErr } = await supabase
          .from("candidate_accounts")
          .select("*")
          .eq("candidate_id", candidateId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (accErr) throw new Error(accErr.message);
        const acc = accs?.[0] ?? null;

        if (!acc) {
          setError("Account not found. Please register first.");
          setLoading(false);
          return;
        }

        setAccount(acc as CandidateAccount);

        const { data: candidateRow } = await supabase
          .from("candidates")
          .select("role_category")
          .eq("id", candidateId)
          .maybeSingle();
        if (candidateRow?.role_category === "general") setRoleCategory("general");

        const { data: creds, error: credsErr } = await supabase
          .from("candidate_credentials")
          .select("*")
          .eq("candidate_id", candidateId)
          .order("updated_at", { ascending: false });

        if (credsErr) console.warn("Credentials fetch error:", credsErr.message);
        setCredentials((creds ?? []) as Credential[]);

      } catch (err) {
        console.error("Portal load error:", err);
        setError("Failed to load your portal. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [candidateId]);

  // ── Real-time credential updates ──────────────────────────────────────────
  useEffect(() => {
    if (!candidateId) return;
    const channel = supabase
      .channel(`credentials:${candidateId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "candidate_credentials",
        filter: `candidate_id=eq.${candidateId}`,
      }, payload => {
        if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
          const updated = payload.new as Credential;
          setCredentials(prev => {
            const exists = prev.find(c => c.id === updated.id);
            return exists ? prev.map(c => c.id === updated.id ? updated : c) : [...prev, updated];
          });
        } else if (payload.eventType === "DELETE") {
          const deletedId = (payload.old as any).id;
          setCredentials(prev => prev.filter(c => c.id !== deletedId));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [candidateId]);

  const handleCredentialUpdate = useCallback((updated: Credential) => {
    setCredentials(prev => {
      const exists = prev.find(c => c.id === updated.id);
      return exists ? prev.map(c => c.id === updated.id ? updated : c) : [...prev, updated];
    });
  }, []);

  // ── Add a custom credential slot ("+" button) ──────────────────────────────
  const handleAddCustom = async () => {
    if (!account || !customLabel.trim()) return;
    setAddingBusy(true);
    try {
      const docType = `custom_${Date.now()}`;
      const { data, error } = await supabase
        .from("candidate_credentials")
        .insert({
          candidate_account_id: account.id,
          candidate_id: candidateId,
          tenant_id: tenantId,
          doc_type: docType,
          name: customLabel.trim(),
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setCredentials(prev => [...prev, data as Credential]);
      setCustomLabel("");
      setAddingCustom(false);
    } catch (err) {
      console.error("Add custom credential failed:", err);
    } finally {
      setAddingBusy(false);
    }
  };

  const handleRemoveDynamic = async (credentialId: string) => {
    await supabase.from("candidate_credentials").delete().eq("id", credentialId);
    setCredentials(prev => prev.filter(c => c.id !== credentialId));
  };

  const handleSubmit = async () => {
    if (!account) return;
    setSubmitError("");

    // Only the base, role-appropriate types block submission — a custom
    // slot the candidate added and abandoned shouldn't trap them.
    const missing = baseTypes.filter(t => {
      const cred = credentials.find(c => c.doc_type === t.key);
      return t.required && (!cred || cred.status === "pending");
    });

    if (missing.length > 0) {
      setSubmitError(`Please upload the following required documents: ${missing.map(m => m.label).join(", ")}`);
      return;
    }

    const rejected = credentials.filter(c => c.status === "rejected");
    if (rejected.length > 0) {
      setSubmitError(`Please re-upload rejected documents before submitting: ${rejected.map(c => c.doc_type).join(", ")}`);
      return;
    }

    setSubmitting(true);

    try {
      await withRetry(async () => {
        const { error: submitErr } = await supabase
          .from("candidate_credentials")
          .update({ submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("candidate_id", candidateId)
          .eq("status", "uploaded");
        if (submitErr) throw new Error(submitErr.message);
      });

      const docsToSync = effectiveTypes.map(t => {
        const cred = credentials.find(c => c.doc_type === t.key);
        return {
          tenant_id: tenantId,
          candidate_id: candidateId,
          candidate_account_id: account.id,
          name: t.label,
          employee_name: account.full_name,
          status: cred?.status === "approved" ? "approved" : "pending",
          file_url: cred?.file_url ?? null,
          file_name: cred?.file_name ?? null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      for (const doc of docsToSync) {
        await withRetry(async () => {
          const { data: existing } = await supabase
            .from("compliance_docs")
            .select("id")
            .eq("candidate_id", candidateId)
            .eq("name", doc.name)
            .limit(1);

          if (existing?.[0]) {
            await supabase.from("compliance_docs").update(doc).eq("id", existing[0].id);
          } else {
            await supabase.from("compliance_docs").insert({ ...doc, created_at: new Date().toISOString() });
          }
        });
      }

      setSubmitted(true);

    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = `/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`;
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto" />
        <p className="text-zinc-600 text-xs">Loading your portal...</p>
      </div>
    </div>
  );

  if (error && !account) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={36} className="text-red-400 mx-auto" />
        <p className="text-white font-semibold">Portal Error</p>
        <p className="text-zinc-400 text-sm">{error}</p>
        <a href={`/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`}
          className="inline-block mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition">
          Create Account
        </a>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl mx-auto">🎉</div>
        <h1 className="text-2xl font-bold text-white">Documents Submitted!</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Your credentials have been submitted for review. The compliance team will review each
          document and notify you if anything needs to be re-uploaded.
        </p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left space-y-1">
          {effectiveTypes.map(t => {
            const cred = credentials.find(c => c.doc_type === t.key);
            return (
              <div key={t.key} className="flex items-center gap-2 text-xs">
                {cred?.status === "uploaded" || cred?.status === "approved"
                  ? <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                  : <XCircle size={12} className="text-zinc-600 flex-shrink-0" />}
                <span className={cred ? "text-zinc-300" : "text-zinc-600"}>{t.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Brain size={11} className="text-indigo-400" />
          <span>Managed by Xavier AI · PivotOps</span>
        </div>
      </div>
    </div>
  );

  const uploadedCount = baseTypes.filter(t => credentials.find(c => c.doc_type === t.key && c.status !== "pending")).length;
  const approvedCount = credentials.filter(c => c.status === "approved").length;
  const rejectedCount = credentials.filter(c => c.status === "rejected").length;
  const allUploaded = uploadedCount === baseTypes.length;
  const pct = Math.round((uploadedCount / baseTypes.length) * 100);

  return (
    <div className="min-h-screen bg-[#080810]">
      <div className="sticky top-0 z-10 bg-[#080810]/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">PivotOps · Compliance Portal</span>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Credential Submission</h1>
          <p className="text-zinc-500 text-sm mt-1">Upload all required documents to complete your onboarding.</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Your Profile</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {([
              ["Full Name", account?.full_name ?? "—"],
              ["Email", account?.email ?? "—"],
              ["Role", account?.role ?? "Candidate"],
              ["SSN Last 4", account?.ssn_last4 ? `***-**-${account.ssn_last4}` : "—"],
              ["Location", [account?.city, account?.state].filter(Boolean).join(", ") || "—"],
              ["Country", account?.country ?? "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-zinc-800/50 px-3 py-2">
                <p className="text-zinc-600 uppercase tracking-wider text-[9px]">{label}</p>
                <p className="text-white font-medium mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-zinc-500">Upload progress</span>
            <span className="text-white font-medium">{uploadedCount} / {baseTypes.length} · {pct}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${allUploaded ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-[10px]">
            {approvedCount > 0 && <span className="text-emerald-400">✓ {approvedCount} Approved</span>}
            {rejectedCount > 0 && <span className="text-red-400">⚠ {rejectedCount} Need re-upload</span>}
            {allUploaded && rejectedCount === 0 && <span className="text-emerald-400">All documents ready to submit</span>}
          </div>
        </div>

        {rejectedCount > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed">
              {rejectedCount} document{rejectedCount > 1 ? "s were" : " was"} rejected by the compliance team.
              Please re-upload the correct files before resubmitting.
            </p>
          </div>
        )}

        {submitError && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {submitError}
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Required Documents</h2>
          {effectiveTypes.map(type => (
            <CredentialRow
              key={type.key}
              type={type}
              credential={credentials.find(c => c.doc_type === type.key) ?? null}
              accountId={account?.id ?? ""}
              candidateId={candidateId}
              tenantId={tenantId}
              onUpdate={handleCredentialUpdate}
              removable={!baseKeys.has(type.key)}
              onRemove={() => {
                const cred = credentials.find(c => c.doc_type === type.key);
                if (cred) handleRemoveDynamic(cred.id);
              }}
            />
          ))}

          {/* "+" add custom credential slot — general roles only */}
          {roleCategory === "general" && (
            addingCustom ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 flex items-center gap-2">
                <input
                  autoFocus
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                  placeholder="e.g. Food Handler Permit"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleAddCustom}
                  disabled={addingBusy || !customLabel.trim()}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40 transition"
                >
                  {addingBusy ? "Adding..." : "Add"}
                </button>
                <button
                  onClick={() => { setAddingCustom(false); setCustomLabel(""); }}
                  className="px-2 py-2 text-zinc-500 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingCustom(true)}
                className="w-full rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 p-4 flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition"
              >
                <Plus size={14} /> Add another credential
              </button>
            )
          )}
        </div>

        <button onClick={handleSubmit} disabled={submitting || uploadedCount === 0}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition shadow-lg shadow-emerald-900/20">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          {submitting ? "Submitting..." : `Submit ${uploadedCount} Document${uploadedCount !== 1 ? "s" : ""} for Review`}
        </button>

        <p className="text-center text-xs text-zinc-700 pb-4">
          Documents are encrypted and stored securely. Only authorised compliance officers can access them.
        </p>
      </div>
    </div>
  );
}

// ── Params reader ─────────────────────────────────────────────────────────────
function ParamsReader() {
  const [candidateId, setCandidateId] = useState("");
  const [tenantId, setTenantId] = useState("default");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cId = p.get("candidateId") ?? "";
    const tId = p.get("tenantId") ?? "default";
    setCandidateId(cId);
    setTenantId(tId);
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  );

  if (!candidateId) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={36} className="text-red-400 mx-auto" />
        <p className="text-white font-semibold">Invalid Portal Link</p>
        <p className="text-zinc-400 text-sm">This link is missing a candidate ID. Please use the link sent by the recruitment team.</p>
      </div>
    </div>
  );

  return <CandidatePortalPage candidateId={candidateId} tenantId={tenantId} />;
}

export default function Page() {
  return <ParamsReader />;
}