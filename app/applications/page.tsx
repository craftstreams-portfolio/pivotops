"use client";

import { useState, useRef } from "react";
import { isValidEmail } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import {
  User, Mail, Phone, Briefcase, FileText,
  Upload, Link2, Building2, Clock,
  CheckCircle2, AlertCircle, X, Brain,
  Loader2, ChevronRight,
} from "lucide-react";

interface Toast { id: string; type: "success" | "error" | "info"; message: string; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const colors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error:   "bg-red-500/15 border-red-500/30 text-red-300",
    info:    "bg-blue-500/15 border-blue-500/30 text-blue-300",
  };
  const Icons = { success: CheckCircle2, error: AlertCircle, info: Brain };
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => {
        const Icon = Icons[t.type];
        return (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm shadow-lg ${colors[t.type]}`}>
            <Icon size={15} className="flex-shrink-0 mt-0.5" />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

const inputCls = `w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3
  text-sm text-white placeholder-zinc-600 outline-none
  focus:border-zinc-600 transition`;

const labelCls = "flex items-center gap-2 text-xs text-zinc-500 mb-1.5 font-medium";

const ROLES = [
  "Registered Nurse (RN)",
  "Licensed Practical Nurse (LPN)",
  "Nurse Practitioner (NP)",
  "Physician Assistant (PA)",
  "Physician / Doctor",
  "Allied Health Professional",
  "Locum Tenens",
  "Clinical Therapist",
  "Pharmacist",
  "Radiographer",
  "Physiotherapist",
  "Healthcare Administrator",
  "Other",
];

type Step = 1 | 2 | 3;

export default function ApplicationPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [step,      setStep]      = useState<Step>(1);
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result,    setResult]    = useState<{
    score: number; decision: string; message: string;
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Form fields
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [phone,           setPhone]           = useState("");
  const [linkedinUrl,     setLinkedinUrl]     = useState("");
  const [role,            setRole]            = useState("");
  const [customRole,      setCustomRole]      = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [coverLetter,     setCoverLetter]     = useState("");
  const [resumeFile,      setResumeFile]      = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  };

  // ── Resume upload ──────────────────────────────────────────
  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      showToast("error", "Please upload a PDF or Word document");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("error", "Resume must be under 10MB");
      return;
    }
    setResumeFile(file);
  };

  const uploadResume = async (candidateId: string): Promise<string | null> => {
    if (!resumeFile) return null;
    setResumeUploading(true);
    try {
      const ext  = resumeFile.name.split(".").pop();
      const path = `${tenantId}/${candidateId}.${ext}`;

      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, resumeFile, { upsert: true });

      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("resumes").getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      showToast("error", `Resume upload failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setResumeUploading(false);
    }
  };

  // ── Step validation ────────────────────────────────────────
  const canProceedStep1 = fullName.trim() && email.trim() && phone.trim();
  const canProceedStep2 = (role && role !== "Other" || customRole.trim()) && yearsExperience;
  const canSubmit       = canProceedStep1 && canProceedStep2;

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    if (!isValidEmail(email)) { showToast("error", "Please enter a valid email address."); return; }
    setLoading(true);

    try {
      showToast("info", "🧠 Xavier AI is scoring your application...");

      const tempId    = crypto.randomUUID();
      const resumeUrl = await uploadResume(tempId);

      const res = await fetch("/api/recruitment/applications", {  // ← FIXED (was /api/recruitment/apply)
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:             fullName.trim(),
          email:            email.trim(),
          phone:            phone.trim(),
          linkedin_url:     linkedinUrl.trim(),
          role:             role === "Other" ? customRole.trim() : role,
          years_experience: parseInt(yearsExperience) || 0,
          current_employer: currentEmployer.trim(),
          cover_letter:     coverLetter.trim(),
          resume_url:       resumeUrl,
          resume_name:      resumeFile?.name ?? null,
          tenant_id:        tenantId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Application submit failed:", msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Loading...
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────
  if (submitted && result) {
    const isInterview = result.decision === "auto_interview";
    const isReview    = result.decision === "manual_review";
    const isRejected  = result.decision === "auto_reject";

    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl
            ${isInterview ? "bg-emerald-500/20" : isReview ? "bg-amber-500/20" : "bg-red-500/20"}`}>
            {isInterview ? "🎉" : isReview ? "🔍" : "📋"}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">
              {isInterview ? "Congratulations!" : isReview ? "Application Received" : "Application Submitted"}
            </h1>
            <p className="text-zinc-400 text-sm mt-2">
              {isInterview
                ? "Your application scored highly. You'll hear from us shortly about interview scheduling."
                : isReview
                  ? "Your application has been received and is under review by our recruitment team."
                  : "Thank you for your interest. We've reviewed your application and will keep your details on file."
              }
            </p>
          </div>

          {/* Xavier AI score card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Xavier AI Assessment
              </span>
            </div>

            <div className="flex items-center gap-4 mb-3">
              <div className={`text-4xl font-bold ${
                isInterview ? "text-emerald-400" :
                isReview    ? "text-amber-400"   : "text-red-400"
              }`}>
                {result.score}
              </div>
              <div>
                <p className="text-white text-sm font-medium">/ 100</p>
                <p className="text-zinc-500 text-xs">Application Score</p>
              </div>
              <div className="ml-auto">
                <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border
                  ${isInterview ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                    isReview    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"       :
                                  "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                  {isInterview ? "Interview Track" : isReview ? "Under Review" : "Not Selected"}
                </span>
              </div>
            </div>

            {/* Score bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isInterview ? "bg-emerald-500" : isReview ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${result.score}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-zinc-600">
            Reference: {fullName} · {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }

  // ── Step indicator ─────────────────────────────────────────
  const steps = [
    { n: 1, label: "Personal Info"     },
    { n: 2, label: "Role & Experience" },
    { n: 3, label: "Cover Letter"      },
  ];

  return (
    <>
      <ToastContainer toasts={toasts} />

      <div className="min-h-screen bg-[#080810] py-10 px-4">
        <div className="w-full max-w-2xl mx-auto space-y-6">

          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Brain size={20} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Xavier AI · Application Portal
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">Apply for a Position</h1>
            <p className="text-zinc-400 text-sm mt-2">
              Your application is scored instantly. Qualified candidates are contacted within 24 hours.
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                                text-xs font-bold transition-colors
                  ${step > s.n
                    ? "bg-emerald-500 text-white"
                    : step === s.n
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-600"
                  }`}>
                  {step > s.n ? "✔" : s.n}
                </div>
                <span className={`text-xs hidden sm:block ${
                  step === s.n ? "text-white" : "text-zinc-600"
                }`}>{s.label}</span>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px ${step > s.n ? "bg-emerald-500" : "bg-zinc-800"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">

            {/* ── STEP 1: Personal Info ── */}
            {step === 1 && (
              <>
                <h2 className="text-base font-semibold text-white">Personal Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><User size={12} /> Full Name *</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Mail size={12} /> Email Address *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@email.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Phone size={12} /> Phone Number *</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 000 0000" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Link2 size={12} /> LinkedIn Profile</label>
                    <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="linkedin.com/in/johndoe" className={inputCls} />
                  </div>
                </div>

                {/* Resume upload */}
                <div>
                  <label className={labelCls}><FileText size={12} /> Resume / CV</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed
                                cursor-pointer transition-colors
                      ${resumeFile
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                      }`}
                  >
                    {resumeFile ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{resumeFile.name}</p>
                          <p className="text-xs text-zinc-500">
                            {(resumeFile.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                          className="ml-auto text-zinc-600 hover:text-red-400 transition"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload size={18} className="text-zinc-500 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-zinc-400">Click to upload resume</p>
                          <p className="text-xs text-zinc-600">PDF or Word · Max 10MB</p>
                        </div>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeSelect} />
                </div>
              </>
            )}

            {/* ── STEP 2: Role & Experience ── */}
            {step === 2 && (
              <>
                <h2 className="text-base font-semibold text-white">Role & Experience</h2>

                <div>
                  <label className={labelCls}><Briefcase size={12} /> Role Applying For *</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls + " cursor-pointer"}>
                    <option value="" className="bg-zinc-900">Select a role...</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-zinc-900">{r}</option>
                    ))}
                  </select>
                  {role === "Other" && (
                    <input value={customRole} onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Specify your role..."
                      className={inputCls + " mt-2"} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><Clock size={12} /> Years of Experience *</label>
                    <select value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)}
                      className={inputCls + " cursor-pointer"}>
                      <option value="" className="bg-zinc-900">Select...</option>
                      {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"].map((y) => (
                        <option key={y} value={y} className="bg-zinc-900">{y} {y === "1" ? "year" : "years"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}><Building2 size={12} /> Current / Last Employer</label>
                    <input value={currentEmployer} onChange={(e) => setCurrentEmployer(e.target.value)}
                      placeholder="Hospital or clinic name" className={inputCls} />
                  </div>
                </div>

                {/* Xavier scoring preview */}
                <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain size={14} className="text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-400">Xavier AI Scoring Criteria</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                    {[
                      ["Experience",   "Up to 25 pts"],
                      ["Cover Letter", "Up to 15 pts"],
                      ["Resume",       "Up to 10 pts"],
                      ["Role Match",   "Up to 15 pts"],
                      ["LinkedIn",     "Up to 5 pts"],
                      ["Contact Info", "Up to 5 pts"],
                    ].map(([label, pts]) => (
                      <div key={label} className="flex justify-between">
                        <span>{label}</span>
                        <span className="text-indigo-400">{pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: Cover Letter ── */}
            {step === 3 && (
              <>
                <h2 className="text-base font-semibold text-white">Cover Letter</h2>
                <p className="text-zinc-500 text-sm">
                  A strong cover letter significantly improves your score. Tell us why you're a great fit.
                </p>

                <div>
                  <label className={labelCls}>
                    <FileText size={12} />
                    Cover Letter
                    <span className={`ml-auto text-[10px] ${
                      coverLetter.length > 300 ? "text-emerald-400" :
                      coverLetter.length > 100 ? "text-amber-400"   : "text-zinc-600"
                    }`}>
                      {coverLetter.length} chars {coverLetter.length > 300 ? "· +15pts" : coverLetter.length > 100 ? "· +8pts" : "· +3pts"}
                    </span>
                  </label>
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={10}
                    placeholder={`Dear Hiring Team,\n\nI am applying for the ${role || "[Role]"} position because...\n\nMy experience includes...\n\nI believe I would be an excellent fit because...`}
                    className={inputCls + " resize-none leading-relaxed"}
                  />
                </div>

                {/* Application summary */}
                <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4 space-y-2">
                  <p className="text-xs font-semibold text-white mb-3">Application Summary</p>
                  {[
                    ["Name",       fullName],
                    ["Email",      email],
                    ["Phone",      phone],
                    ["Role",       role === "Other" ? customRole : role],
                    ["Experience", yearsExperience ? `${yearsExperience} years` : "—"],
                    ["Resume",     resumeFile?.name ?? "Not attached"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-white truncate max-w-[200px] text-right">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm
                             text-zinc-400 hover:text-white transition"
                >
                  Back
                </button>
              )}

              {step < 3 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                             bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                             disabled:opacity-40 transition"
                >
                  Continue
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                             bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                             disabled:opacity-40 transition"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Scoring with Xavier AI...</>
                  ) : (
                    <><Brain size={15} /> Submit Application</>
                  )}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-zinc-700">
            Your application is processed by Xavier AI and reviewed by our recruitment team.
            All data is handled securely.
          </p>
        </div>
      </div>
    </>
  );
}