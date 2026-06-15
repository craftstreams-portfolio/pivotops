"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  User, Mail, Lock, Eye, EyeOff,
  CheckCircle2, AlertCircle, Brain, Loader2,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition";

interface Toast { type: "success" | "error" | "info"; message: string; }

// ── Retry helper — retries async fn up to N times with exponential backoff ───
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

function RegisterForm({ candidateId, tenantId }: { candidateId: string; tenantId: string }) {
  const router = useRouter();

  const [step,     setStep]     = useState<1 | 2>(1);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<Toast | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");

  // Step 2
  const [ssn4,    setSsn4]    = useState("");
  const [city,    setCity]    = useState("");
  const [state,   setState]   = useState("");
  const [country, setCountry] = useState("United States");

  const showToast = (type: Toast["type"], message: string, duration = 6000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  // ── Pre-flight: check if candidate already has an account ─────────────────
  useEffect(() => {
    if (!candidateId) return;
    supabase.from("candidates")
      .select("status")
      .eq("id", candidateId)
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data }) => {
        if (data?.status === "registered") {
          showToast("info", "You already have an account. Redirecting to login...", 3000);
          setTimeout(() => {
            window.location.href = `/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`;
          }, 2000);
        }
      });
  }, [candidateId, tenantId]);

  const step1Valid = fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    password === confirm;

  const handleCreate = async () => {
    if (!step1Valid) { showToast("error", "Please complete all fields correctly."); return; }
    setLoading(true);

    try {
      // ── Step A: Sign up with Supabase Auth ──────────────────────────────
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name:    fullName.trim(),
            role:         "candidate",
            candidate_id: candidateId,
            tenant_id:    tenantId,
          },
        },
      });

      // Already registered → redirect to login
      if (authErr) {
        const msg = authErr.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
          showToast("info", "Account already exists. Redirecting to login...", 3000);
          setTimeout(() => {
            window.location.href = `/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`;
          }, 2000);
          return;
        }
        throw new Error(authErr.message);
      }

      // Email confirmation required — Supabase returns user but no session
      if (!authData.session && authData.user) {
        showToast("success", "Check your email to confirm your account, then log in.", 10000);
        setTimeout(() => {
          window.location.href = `/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`;
        }, 4000);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) throw new Error("Account creation failed — no user ID returned.");

      // ── Step B: Upsert candidate_accounts (idempotent) ──────────────────
      await withRetry(async () => {
        const { error: accErr } = await supabase
          .from("candidate_accounts")
          .upsert({
            candidate_id: candidateId || null,
            tenant_id:    tenantId,
            auth_user_id: userId,
            full_name:    fullName.trim(),
            email:        email.trim().toLowerCase(),
            ssn_last4:    ssn4.trim()    || null,
            city:         city.trim()    || null,
            state:        state.trim()   || null,
            country:      country.trim() || "United States",
            updated_at:   new Date().toISOString(),
          }, {
            onConflict: "auth_user_id",
            ignoreDuplicates: false,
          });
        if (accErr) throw new Error(accErr.message);
      });

      // ── Step C: Mark candidate as registered (idempotent) ───────────────
      if (candidateId) {
        await withRetry(async () => {
          await supabase.from("candidates").update({
            name:          fullName.trim(),
            auth_user_id:  userId,
            status:        "registered",
            registered_at: new Date().toISOString(),
          }).eq("id", candidateId).eq("tenant_id", tenantId);
        });
      }

      showToast("success", "Account created! Redirecting to your portal...", 3000);
      setTimeout(() => {
        window.location.href = `/candidate/portal?candidateId=${candidateId}&tenantId=${tenantId}`;
      }, 1500);

    } catch (err) {
      console.error("Registration error:", err);
      showToast("error", err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Guard: missing candidateId ───────────────────────────────────────────
  if (!candidateId) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={36} className="text-red-400 mx-auto" />
        <p className="text-white font-semibold">Invalid Registration Link</p>
        <p className="text-zinc-400 text-sm">This link is missing a candidate ID. Please use the invite link sent by the recruitment team.</p>
      </div>
    </div>
  );

  const toastColors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error:   "bg-red-500/15 border-red-500/30 text-red-300",
    info:    "bg-blue-500/15 border-blue-500/30 text-blue-300",
  };

  return (
    <div className="min-h-screen bg-[#080810] py-10 px-4">
      <div className="w-full max-w-md mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-400">
            <Brain size={14} />
            <span className="font-semibold uppercase tracking-wider">PivotOps · Candidate Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-zinc-400 text-sm">Set up your account to submit your compliance credentials.</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${toastColors[toast.type]}`}>
            {toast.type === "success" ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${step >= s ? "bg-indigo-500" : "bg-zinc-800"}`} />
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">

          {/* ── Step 1: Account ── */}
          {step === 1 && (<>
            <h2 className="text-sm font-semibold text-white">Account Details</h2>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><User size={11} /> Full Name *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" className={inputCls} />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Mail size={11} /> Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@email.com" className={inputCls} />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Lock size={11} /> Password * (min 8 characters)</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password" className={inputCls + " pr-10"} />
                <button type="button" onClick={() => setShowPass(o => !o)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${password.length >= 12 ? "bg-emerald-500 w-full" : password.length >= 8 ? "bg-amber-500 w-2/3" : "bg-red-500 w-1/3"}`} />
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Lock size={11} /> Confirm Password *</label>
              <div className="relative">
                <input type={showConf ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password" className={inputCls + " pr-10"} />
                <button type="button" onClick={() => setShowConf(o => !o)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button onClick={() => setStep(2)} disabled={!step1Valid}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 transition">
              Continue
            </button>
          </>)}

          {/* ── Step 2: Profile ── */}
          {step === 2 && (<>
            <h2 className="text-sm font-semibold text-white">Profile Information</h2>
            <p className="text-xs text-zinc-500">Optional — helps pre-fill your credential form.</p>

            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Last 4 digits of SSN</label>
              <input value={ssn4} onChange={e => setSsn4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 4521" maxLength={4} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">City</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="New York" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">State</label>
                <input value={state} onChange={e => setState(e.target.value)} placeholder="NY" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Country</label>
              <input value={country} onChange={e => setCountry(e.target.value)} placeholder="United States" className={inputCls} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white transition">
                Back
              </button>
              <button onClick={handleCreate} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {loading ? "Creating..." : "Create Account"}
              </button>
            </div>
          </>)}
        </div>

        <p className="text-center text-xs text-zinc-700">
          Already have an account?{" "}
          <a href={`/candidate/login?candidateId=${candidateId}&tenantId=${tenantId}`}
            className="text-indigo-400 hover:text-indigo-300 transition">Sign in</a>
        </p>
      </div>
    </div>
  );
}

function ParamsReader() {
  const [candidateId, setCandidateId] = useState("");
  const [tenantId,    setTenantId]    = useState("default");
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setCandidateId(p.get("candidateId") ?? "");
    setTenantId("default");
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  );
  return <RegisterForm candidateId={candidateId} tenantId={tenantId} />;
}

export default function Page() {
  return <ParamsReader />;
}
