"use client";

import { useState, useRef, useEffect } from "react";
import { isValidEmail } from "@/lib/validation";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Toast { id: string; type: "success" | "error" | "info"; message: string; }

const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition";
const labelCls = "flex items-center gap-2 text-xs text-zinc-500 mb-1.5 font-medium";

const HEALTHCARE_ROLES = [
  "Registered Nurse (RN)", "Licensed Practical Nurse (LPN)", "Nurse Practitioner (NP)",
  "Physician Assistant (PA)", "Physician / Doctor", "Allied Health Professional",
  "Locum Tenens", "Clinical Therapist", "Pharmacist", "Radiographer",
  "Physiotherapist", "Healthcare Administrator",
];

type Step = 1 | 2 | 3;

export default function ApplyPortalPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [resolving, setResolving] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [resolveError, setResolveError] = useState("");

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; decision: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [roleType, setRoleType] = useState<"healthcare" | "general">("healthcare");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  };

  /* ── Resolve tenant from slug ── */
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/tenant-lookup?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setResolveError("This apply link isn't valid. Double-check the URL with the recruiter who sent it.");
        } else {
          setTenantId(data.tenantId);
          setTenantName(data.tenantName);
        }
      })
      .catch(() => setResolveError("Couldn't load this apply page. Please try again."))
      .finally(() => setResolving(false));
  }, [slug]);

  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) { showToast("error", "Please upload a PDF or Word document"); return; }
    if (file.size > 10 * 1024 * 1024) { showToast("error", "Resume must be under 10MB"); return; }
    setResumeFile(file);
  };

  const uploadResume = async (candidateId: string): Promise<string | null> => {
    if (!resumeFile || !tenantId) return null;
    try {
      const ext = resumeFile.name.split(".").pop();
      const path = `${tenantId}/${candidateId}.${ext}`;
      const { error } = await supabase.storage.from("resumes").upload(path, resumeFile, { upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("resumes").getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      showToast("error", `Resume upload failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  const finalRole = roleType === "healthcare" ? role : (role === "Other" ? customRole : role) || customRole;
  const canProceedStep1 = fullName.trim() && email.trim() && phone.trim();
  const canProceedStep2 = finalRole.trim().length > 0 && yearsExperience;
  const canSubmit = canProceedStep1 && canProceedStep2 && !!tenantId;

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    if (!isValidEmail(email)) { showToast("error", "Please enter a valid email address."); return; }
    setLoading(true);
    try {
      const tempId = crypto.randomUUID();
      const resumeUrl = await uploadResume(tempId);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const res = await fetch("/api/recruitment/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          linkedin_url: linkedinUrl.trim(),
          role: finalRole,
          role_category: roleType,
          years_experience: parseInt(yearsExperience) || 0,
          current_employer: currentEmployer.trim(),
          cover_letter: coverLetter.trim(),
          resume_url: resumeUrl,
          resume_name: resumeFile?.name ?? null,
          tenant_id: tenantId,
          applied_timezone: timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  /* ── Resolving / error states ── */
  if (resolving) {
    return <div className="min-h-screen bg-[#080810] flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;
  }
  if (resolveError) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <p className="text-zinc-400 text-sm text-center max-w-sm">{resolveError}</p>
      </div>
    );
  }

  /* ── Success screen — summary only, no account/login link ── */
  if (submitted && result) {
    const isInterview = result.decision === "auto_interview";
    const isReview = result.decision === "manual_review";
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl ${isInterview ? "bg-emerald-500/20" : isReview ? "bg-amber-500/20" : "bg-red-500/20"}`}>
            {isInterview ? "🎉" : isReview ? "🔍" : "📋"}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isInterview ? "You've been shortlisted" : isReview ? "Application received" : "Application submitted"}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isInterview
              ? `Great news — you've made the shortlist for this role at ${tenantName}. The team will follow up shortly with next steps. We've also sent a confirmation to your email.`
              : isReview
              ? `Thanks for applying to ${tenantName}. Your application is under review and the team will be in touch soon.`
              : `Thank you for your interest in ${tenantName}. We'll keep your details on file for future opportunities.`}
          </p>
        </div>
      </div>
    );
  }

  /* ── Application form ── */
  const steps = [{ n: 1, label: "Personal Info" }, { n: 2, label: "Role & Experience" }, { n: 3, label: "Cover Letter" }];

  return (
    <div className="min-h-screen bg-[#080810] py-10 px-4">
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl border text-sm ${t.type === "error" ? "bg-red-500/15 border-red-500/30 text-red-300" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"}`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Apply to {tenantName}</h1>
          <p className="text-zinc-400 text-sm mt-2">Your application is scored instantly. Qualified candidates are contacted within 24 hours.</p>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step > s.n ? "bg-emerald-500 text-white" : step === s.n ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-600"}`}>
                {step > s.n ? "✔" : s.n}
              </div>
              <span className={`text-xs hidden sm:block ${step === s.n ? "text-white" : "text-zinc-600"}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.n ? "bg-emerald-500" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-white">Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email Address *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@email.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone Number *</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>LinkedIn Profile</label>
                  <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/johndoe" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Resume / CV</label>
                <div onClick={() => fileRef.current?.click()} className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${resumeFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"}`}>
                  {resumeFile ? (
                    <p className="text-sm text-white">{resumeFile.name}</p>
                  ) : (
                    <p className="text-sm text-zinc-400">Click to upload resume · PDF or Word · Max 10MB</p>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeSelect} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-white">Role & Experience</h2>

              <div>
                <label className={labelCls}>What kind of role is this?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setRoleType("healthcare"); setRole(""); setCustomRole(""); }}
                    className={`py-3 rounded-xl text-sm font-medium border transition ${roleType === "healthcare" ? "bg-indigo-600 border-indigo-600 text-white" : "border-zinc-700 text-zinc-400"}`}
                  >
                    Healthcare role
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRoleType("general"); setRole(""); setCustomRole(""); }}
                    className={`py-3 rounded-xl text-sm font-medium border transition ${roleType === "general" ? "bg-indigo-600 border-indigo-600 text-white" : "border-zinc-700 text-zinc-400"}`}
                  >
                    Other / General role
                  </button>
                </div>
              </div>

              {roleType === "healthcare" ? (
                <div>
                  <label className={labelCls}>Role Applying For *</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls + " cursor-pointer"}>
                    <option value="" className="bg-zinc-900">Select a role...</option>
                    {HEALTHCARE_ROLES.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Role Title *</label>
                  <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="e.g. Store Associate, Warehouse Lead" className={inputCls} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Years of Experience *</label>
                  <select value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className={inputCls + " cursor-pointer"}>
                    <option value="" className="bg-zinc-900">Select...</option>
                    {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"].map((y) => <option key={y} value={y} className="bg-zinc-900">{y} {y === "1" ? "year" : "years"}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Current / Last Employer</label>
                  <input value={currentEmployer} onChange={(e) => setCurrentEmployer(e.target.value)} placeholder="Company name" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-white">Cover Letter</h2>
              <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={10} placeholder="Tell us why you're a great fit..." className={inputCls + " resize-none leading-relaxed"} />
            </>
          )}

          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as Step)} className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition">Back</button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep((s) => (s + 1) as Step)} disabled={step === 1 ? !canProceedStep1 : !canProceedStep2} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 transition">Continue</button>
            ) : (
              <button onClick={handleSubmit} disabled={loading || !canSubmit} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition">
                {loading ? "Scoring with Xavier AI..." : "Submit Application"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}