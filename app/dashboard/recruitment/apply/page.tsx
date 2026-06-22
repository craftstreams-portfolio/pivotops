"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import {
  User, Mail, Phone, Briefcase, FileText,
  Upload, Link2, Building2, Clock,
  CheckCircle2, AlertCircle, X, Brain,
  Loader2, ChevronRight, ChevronDown, ArrowLeft,
} from "lucide-react";

interface Toast { id: string; type: "success" | "error" | "info"; message: string; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  const colors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error:   "bg-red-500/15 border-red-500/30 text-red-300",
    info:    "bg-blue-500/15 border-blue-500/30 text-blue-300",
  };
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm shadow-lg ${colors[t.type]}`}>
          {t.type === "success" ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> :
           t.type === "error"   ? <AlertCircle  size={15} className="flex-shrink-0 mt-0.5" /> :
                                  <Brain        size={15} className="flex-shrink-0 mt-0.5" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

const inputCls = `w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition`;
const labelCls = "flex items-center gap-2 text-xs text-zinc-500 mb-1.5 font-medium";

// ── SECTOR / ROLE TAXONOMY ─────────────────────────────────────────────────────
const SECTORS: Record<string, string[]> = {
  "Healthcare": [
    "Registered Nurse (RN)", "Licensed Practical Nurse (LPN)", "Nurse Practitioner (NP)",
    "Physician Assistant (PA)", "Physician / Doctor", "Clinical Therapist",
    "Pharmacist", "Radiographer", "Physiotherapist", "Paramedic / EMT",
    "Healthcare Administrator", "Allied Health Professional", "Locum Tenens",
    "Midwife", "Occupational Therapist", "Speech & Language Therapist",
    "Mental Health Counsellor", "Dental Nurse", "Optometrist",
  ],
  "HR & Recruitment": [
    "HR Manager", "HR Business Partner", "Talent Acquisition Specialist",
    "Recruiter", "Headhunter", "HR Generalist", "Compensation & Benefits Analyst",
    "Learning & Development Manager", "HR Director", "People Operations Manager",
    "Workforce Planner", "Employer Branding Specialist",
  ],
  "Operations": [
    "Operations Manager", "Chief Operating Officer (COO)", "Process Improvement Analyst",
    "Business Operations Analyst", "Supply Chain Manager", "Project Manager",
    "Programme Manager", "Operations Coordinator", "Quality Assurance Manager",
    "Facilities Manager", "Procurement Manager",
  ],
  "Legal": [
    "Solicitor / Attorney", "Paralegal", "Legal Counsel", "Compliance Officer",
    "Contract Manager", "Legal Secretary", "Barrister / Advocate",
    "Intellectual Property Specialist", "Employment Lawyer", "Data Protection Officer (DPO)",
  ],
  "Information Technology": [
    "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
    "DevOps Engineer", "Cloud Architect", "Data Engineer", "Data Scientist",
    "Machine Learning Engineer", "Cybersecurity Analyst", "IT Support Specialist",
    "Product Manager (Tech)", "QA Engineer", "Mobile Developer", "UI/UX Designer",
    "Systems Administrator", "Network Engineer", "Technical Lead", "CTO",
  ],
  "Logistics & Supply Chain": [
    "Logistics Coordinator", "Warehouse Manager", "Fleet Manager",
    "Supply Chain Analyst", "Freight Forwarder", "Distribution Manager",
    "Inventory Control Specialist", "Last-Mile Delivery Manager", "Import/Export Specialist",
    "Customs Broker", "Transport Planner",
  ],
  "Admin & Executive Support": [
    "Executive Assistant", "Office Manager", "Administrative Coordinator",
    "Personal Assistant (PA)", "Data Entry Specialist", "Receptionist",
    "Office Administrator", "Virtual Assistant", "Company Secretary",
  ],
  "GTM / Sales": [
    "Account Executive", "Business Development Manager", "Sales Director",
    "SDR / BDR", "VP of Sales", "Key Account Manager", "Inside Sales Rep",
    "Channel Sales Manager", "Revenue Operations Analyst", "Pre-Sales Consultant",
    "Customer Success Manager",
  ],
  "Marketing & Media": [
    "Marketing Manager", "Content Strategist", "SEO Specialist", "Performance Marketer",
    "Brand Manager", "Social Media Manager", "Copywriter", "Creative Director",
    "PR Manager", "Growth Hacker", "Video Producer", "Graphic Designer",
    "Media Buyer", "Email Marketing Specialist", "Campaign Manager",
  ],
  "Finance & Accounting": [
    "Financial Analyst", "Accountant", "CFO", "Controller", "Bookkeeper",
    "Tax Specialist", "Audit Manager", "Treasury Analyst", "FP&A Manager",
    "Payroll Specialist", "Risk Manager", "Investment Analyst",
  ],
  "Customer Experience": [
    "Customer Support Agent", "Customer Experience Manager", "Head of CX",
    "Support Team Lead", "Customer Success Specialist", "Community Manager",
    "Technical Support Engineer",
  ],
  "Other": ["Other / Specify below"],
};

// Keywords Xavier uses per sector for scoring
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "Healthcare": ["patient care","clinical","medication","nursing license","BLS","CPR","EMR","EHR","triage","bedside","ward","shift","HIPAA","credentialing","IV","wound care","acute care","diagnosis"],
  "HR & Recruitment": ["talent acquisition","onboarding","HRIS","employee relations","workforce planning","performance management","applicant tracking","HR policy","compensation","L&D","SHRM","recruitment","sourcing"],
  "Operations": ["process improvement","KPIs","SLA","project management","stakeholder","workflow","supply chain","cost reduction","cross-functional","operations strategy","lean","six sigma","OKR"],
  "Legal": ["compliance","contract","litigation","legal research","due diligence","regulatory","legislation","counsel","employment law","data protection","GDPR","IP","corporate governance"],
  "Information Technology": ["software development","agile","scrum","cloud","AWS","Azure","API","CI/CD","DevOps","cybersecurity","machine learning","full stack","backend","frontend","database","infrastructure","SaaS","architecture"],
  "Logistics & Supply Chain": ["supply chain","logistics","warehouse","inventory","fleet","freight","procurement","distribution","customs","import","export","last mile","ERP","SAP","demand planning"],
  "Admin & Executive Support": ["calendar management","scheduling","travel coordination","office management","stakeholder communication","confidential","executive support","minute taking","CRM","filing","correspondence"],
  "GTM / Sales": ["revenue","pipeline","quota","CRM","Salesforce","prospecting","closing","ARR","MRR","outbound","inbound","account management","B2B","SaaS sales","cold calling","negotiation","deal cycle"],
  "Marketing & Media": ["SEO","content strategy","brand","performance marketing","campaigns","copywriting","social media","analytics","Google Ads","Meta","email marketing","lead generation","ROI","creative","storytelling"],
  "Finance & Accounting": ["financial analysis","P&L","budgeting","forecasting","GAAP","IFRS","reconciliation","audit","tax","accounts payable","accounts receivable","treasury","ERP","financial reporting","risk"],
  "Customer Experience": ["customer satisfaction","CSAT","NPS","ticket resolution","SLA","CRM","Zendesk","Intercom","escalation","onboarding","retention","churn","support"],
  "Other": [],
};

type Step = 1 | 2 | 3;

interface SubmitResult {
  candidateId: string;
  score:       number;
  decision:    string;
  message:     string;
}

export default function ApplicationPage() {
  const { tenantId, loading: tenantLoading } = useTenant();
  const router = useRouter();

  const [step,        setStep]        = useState<Step>(1);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<SubmitResult | null>(null);
  const [toasts,      setToasts]      = useState<Toast[]>([]);

  // Form fields
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [phone,           setPhone]           = useState("");
  const [linkedinUrl,     setLinkedinUrl]     = useState("");
  const [sector,          setSector]          = useState("");
  const [role,            setRole]            = useState("");
  const [customRole,      setCustomRole]      = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [coverLetter,     setCoverLetter]     = useState("");
  const [resumeFile,      setResumeFile]      = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [sectorOpen,      setSectorOpen]      = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  };

  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) { showToast("error", "Please upload a PDF or Word document"); return; }
    if (file.size > 10 * 1024 * 1024)  { showToast("error", "Resume must be under 10MB"); return; }
    setResumeFile(file);
  };

  const uploadResume = async (candidateId: string): Promise<string | null> => {
    if (!resumeFile) return null;
    setResumeUploading(true);
    try {
      const ext  = resumeFile.name.split(".").pop();
      const path = `${tenantId}/${candidateId}.${ext}`;
      const { error } = await supabase.storage.from("resumes").upload(path, resumeFile, { upsert: true });
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

  const effectiveRole = role === "Other / Specify below" ? customRole.trim() : role;
  const sectorKeywords = sector ? (SECTOR_KEYWORDS[sector] ?? []) : [];

  const canProceedStep1 = fullName.trim() && email.trim() && phone.trim() && linkedinUrl.trim() && resumeFile;
  const canProceedStep2 = sector && (role && role !== "Other / Specify below" || customRole.trim());
  const canSubmit       = canProceedStep1 && canProceedStep2 && coverLetter.trim();

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      showToast("info", "Xavier AI is scoring your application...");
      const tempId    = crypto.randomUUID();
      const resumeUrl = await uploadResume(tempId);

      // Build enriched role string: sector + role + keywords for Xavier
      const enrichedRole = `${sector} - ${effectiveRole}`;
      const keywordHints = sectorKeywords.join(", ");
      const enrichedCover = `SECTOR: ${sector}\nROLE: ${effectiveRole}\nKEY SKILLS FOR THIS ROLE: ${keywordHints}\n\n${coverLetter.trim()}`;

      const res = await fetch("/api/recruitment/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:             fullName.trim(),
          email:            email.trim(),
          phone:            phone.trim(),
          linkedin_url:     linkedinUrl.trim(),
          role:             enrichedRole,
          years_experience: parseInt(yearsExperience) || 0,
          current_employer: currentEmployer.trim(),
          cover_letter:     enrichedCover,
          resume_url:       resumeUrl,
          resume_name:      resumeFile?.name ?? null,
          tenant_id:        tenantId,
          sector,
          sector_keywords:  sectorKeywords,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);

      setResult({
        candidateId: data.candidateId,
        score:       data.score,
        decision:    data.decision,
        message:     data.message,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Application submit failed:", msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>;
  }

  // ── SUCCESS SCREEN ─────────────────────────────────────────────────────────
  if (result) {
    const isInterview = result.decision === "auto_interview";
    const isReview    = result.decision === "manual_review";

    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center space-y-3">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl ${isInterview ? "bg-emerald-500/20" : isReview ? "bg-amber-500/20" : "bg-zinc-800"}`}>
              {isInterview ? "🎉" : isReview ? "🔍" : "📋"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isInterview ? "Congratulations!" : isReview ? "Application Received" : "Application Submitted"}
              </h1>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                {isInterview
                  ? "Your application scored highly. Our recruitment team will be in touch shortly."
                  : isReview
                    ? "Your application is under review by our recruitment team. We will be in touch soon."
                    : "Thank you for your interest. We will keep your details on file for future opportunities."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Xavier AI Assessment</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className={`text-4xl font-bold ${isInterview ? "text-emerald-400" : isReview ? "text-amber-400" : "text-red-400"}`}>{result.score}</div>
              <div><p className="text-white text-sm font-medium">/ 100</p><p className="text-zinc-500 text-xs">Application Score</p></div>
              <span className={`ml-auto text-xs px-3 py-1.5 rounded-full font-semibold border ${isInterview ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : isReview ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                {isInterview ? "Interview Track" : isReview ? "Under Review" : "Not Selected"}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${isInterview ? "bg-emerald-500" : isReview ? "bg-amber-500" : "bg-zinc-600"}`} style={{ width: `${result.score}%` }} />
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard/recruitment")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition"
          >
            <ArrowLeft size={14} /> Back to Recruitment Board
          </button>

          <p className="text-center text-xs text-zinc-700">{fullName} · {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    );
  }

  // ── FORM ───────────────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: "Personal Info"     },
    { n: 2, label: "Role & Experience" },
    { n: 3, label: "Cover Letter"      },
  ];

  const sectorList = Object.keys(SECTORS);
  const roleList   = sector ? SECTORS[sector] ?? [] : [];

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="min-h-screen bg-[#080810] py-10 px-4">
        <div className="w-full max-w-2xl mx-auto space-y-6">

          {/* Back button */}
          <button
            onClick={() => router.push("/dashboard/recruitment")}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition"
          >
            <ArrowLeft size={15} /> Back to Recruitment Board
          </button>

          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Brain size={20} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Xavier AI · Application Portal</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Apply for a Position</h1>
            <p className="text-zinc-400 text-sm mt-2">Scored instantly by Xavier AI across all sectors.</p>
          </div>

          {/* Step indicators */}
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

          {/* Form card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">

            {/* STEP 1 — Personal Info */}
            {step === 1 && (
              <>
                <h2 className="text-base font-semibold text-white">Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><User size={12} /> Full Name *</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Mail size={12} /> Email Address *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@email.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Phone size={12} /> Phone Number *</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}><Link2 size={12} /> LinkedIn Profile *</label>
                    <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/johndoe" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}><FileText size={12} /> Resume / CV *</label>
                  <div onClick={() => fileRef.current?.click()}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${resumeFile ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"}`}>
                    {resumeFile ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0"><p className="text-sm text-white truncate">{resumeFile.name}</p><p className="text-xs text-zinc-500">{(resumeFile.size / 1024).toFixed(0)} KB</p></div>
                        <button onClick={(e) => { e.stopPropagation(); setResumeFile(null); }} className="ml-auto text-zinc-600 hover:text-red-400 transition"><X size={16} /></button>
                      </>
                    ) : (
                      <>
                        <Upload size={18} className="text-zinc-500 flex-shrink-0" />
                        <div><p className="text-sm text-zinc-400">Click to upload resume</p><p className="text-xs text-zinc-600">PDF or Word · Max 10MB</p></div>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeSelect} />
                </div>

                {/* Xavier scoring areas info */}
                <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={14} className="text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-400">Xavier AI scores the following compulsory areas</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400">
                    {[
                      ["Professional Summary",    "Scanned for sector-specific language"],
                      ["Core Skills",             "Matched against role keyword taxonomy"],
                      ["Work Experience",         "Job duties & responsibilities reviewed"],
                      ["LinkedIn Profile",        "Validates professional presence"],
                      ["Cover Letter",            "Depth, relevance, and quality scored"],
                      ["Role + Sector Match",     "Keywords from sector taxonomy applied"],
                    ].map(([area, desc]) => (
                      <div key={area} className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
                        <CheckCircle2 size={11} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div><p className="font-medium text-white">{area}</p><p className="text-zinc-600 text-[10px] mt-0.5">{desc}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 2 — Role & Sector */}
            {step === 2 && (
              <>
                <h2 className="text-base font-semibold text-white">Role & Experience</h2>

                {/* Main Sector selector */}
                <div>
                  <label className={labelCls}><Briefcase size={12} /> Sector / Industry *</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSectorOpen(!sectorOpen)}
                      className={`${inputCls} flex items-center justify-between cursor-pointer text-left ${sector ? "text-white" : "text-zinc-600"}`}
                    >
                      <span>{sector || "Select sector..."}</span>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform flex-shrink-0 ${sectorOpen ? "rotate-180" : ""}`} />
                    </button>
                    {sectorOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                        {sectorList.map((s) => (
                          <button key={s} onClick={() => { setSector(s); setRole(""); setSectorOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition hover:bg-zinc-800 ${sector === s ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-300"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-role selector — appears after sector chosen */}
                {sector && (
                  <div>
                    <label className={labelCls}><Briefcase size={12} /> Role Applying For *</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value="" className="bg-zinc-900">Select role in {sector}...</option>
                      {roleList.map((r) => (
                        <option key={r} value={r} className="bg-zinc-900">{r}</option>
                      ))}
                    </select>
                    {role === "Other / Specify below" && (
                      <input value={customRole} onChange={(e) => setCustomRole(e.target.value)}
                        placeholder="Specify your role..." className={`${inputCls} mt-2`} />
                    )}
                  </div>
                )}

                {/* Sector keyword hints */}
                {sector && sectorKeywords.length > 0 && (
                  <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                      Xavier will look for these {sector} keywords in your resume and cover letter
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sectorKeywords.slice(0, 12).map((kw) => (
                        <span key={kw} className="text-[11px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{kw}</span>
                      ))}
                      {sectorKeywords.length > 12 && (
                        <span className="text-[11px] px-2 py-1 rounded-lg bg-zinc-800 text-zinc-500">+{sectorKeywords.length - 12} more</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}><Clock size={12} /> Years of Experience *</label>
                    <select value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className={`${inputCls} cursor-pointer`}>
                      <option value="" className="bg-zinc-900">Select...</option>
                      {["0","1","2","3","4","5","6","7","8","9","10+"].map((y) => (
                        <option key={y} value={y} className="bg-zinc-900">{y} {y === "1" ? "year" : "years"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}><Building2 size={12} /> Current / Last Employer</label>
                    <input value={currentEmployer} onChange={(e) => setCurrentEmployer(e.target.value)} placeholder="Company name" className={inputCls} />
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 — Cover Letter */}
            {step === 3 && (
              <>
                <h2 className="text-base font-semibold text-white">Cover Letter</h2>
                <p className="text-zinc-500 text-sm">
                  Include your <strong className="text-white">Professional Summary</strong>, <strong className="text-white">Core Skills</strong>, and <strong className="text-white">Work Experience duties</strong> — these are the three sections Xavier AI scores most heavily.
                </p>

                <div>
                  <label className={labelCls}>
                    <FileText size={12} />
                    Cover Letter / Resume Paste *
                    <span className={`ml-auto text-[10px] ${coverLetter.length > 500 ? "text-emerald-400" : coverLetter.length > 200 ? "text-amber-400" : "text-zinc-600"}`}>
                      {coverLetter.length} chars{coverLetter.length > 500 ? " · Strong" : coverLetter.length > 200 ? " · Good" : " · Add more"}
                    </span>
                  </label>
                  <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={12}
                    placeholder={`Professional Summary:\nI am an experienced ${effectiveRole || "[role]"} with X years in ${sector || "[sector]"}...\n\nCore Skills:\n- Skill 1\n- Skill 2\n- Skill 3\n\nWork Experience:\n[Company Name] — [Role]\nResponsibilities:\n- Led...\n- Managed...\n- Delivered...`}
                    className={`${inputCls} resize-none leading-relaxed font-mono`}
                  />
                </div>

                {/* Summary */}
                <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4 space-y-2">
                  <p className="text-xs font-semibold text-white mb-3">Application Summary</p>
                  {[
                    ["Name",       fullName],
                    ["Email",      email],
                    ["Phone",      phone],
                    ["LinkedIn",   linkedinUrl],
                    ["Sector",     sector],
                    ["Role",       effectiveRole || role],
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

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <button onClick={() => setStep((s) => (s - 1) as Step)}
                  className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition">
                  Back
                </button>
              )}
              {step < 3 ? (
                <button onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 transition">
                  Continue <ChevronRight size={15} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={loading || !canSubmit}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition">
                  {loading
                    ? <><Loader2 size={15} className="animate-spin" /> Scoring with Xavier AI...</>
                    : <><Brain size={15} /> Submit Application</>}
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-zinc-700">
            Scored by Xavier AI across 6 compulsory areas including Professional Summary, Core Skills, Work Experience, LinkedIn, Cover Letter, and Role/Sector match.
          </p>
        </div>
      </div>
    </>
  );
}