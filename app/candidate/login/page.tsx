"use client";

import { useState, useEffect } from "react";
import { isValidEmail } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Eye, EyeOff, Brain, Loader2, CheckCircle2, AlertCircle } from "lucide-react";



const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition";

interface Toast { type: "success" | "error" | "info"; message: string; }

function LoginForm({ candidateId, tenantId }: { candidateId: string; tenantId: string }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<Toast | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked,   setLocked]   = useState(false);

  const showToast = (type: Toast["type"], message: string, duration = 6000) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), duration);
  };

  // ── Check if already logged in (only confirmed-email sessions) ────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only auto-redirect a fully confirmed session. The portal resolves the
      // account from the auth session itself, so we do not pass a candidate id.
      if (session?.user?.email_confirmed_at) {
        window.location.href = "/candidate/portal";
      }
    });
  }, []);

  // ── Rate limiting — lock after 5 failed attempts ─────────────────────────
  useEffect(() => {
    if (attempts >= 5) {
      setLocked(true);
      showToast("error", "Too many failed attempts. Please wait 30 seconds.", 30000);
      const t = setTimeout(() => { setLocked(false); setAttempts(0); }, 30000);
      return () => clearTimeout(t);
    }
  }, [attempts]);

  const handleLogin = async () => {
    if (locked) return;
    if (!email.trim() || !password) { showToast("error", "Email and password are required."); return; }
    if (!isValidEmail(email)) { showToast("error", "Please enter a valid email address."); return; }
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setAttempts(a => a + 1);
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
          showToast("error", "Incorrect email or password. Please try again.");
        } else if (msg.includes("confirm")) {
          showToast("info", "Please confirm your email address first, then try again.");
        } else {
          showToast("error", error.message);
        }
        return;
      }

      // Set session explicitly before redirect
      await supabase.auth.setSession({
        access_token:  data.session!.access_token,
        refresh_token: data.session!.refresh_token,
      });

      showToast("success", "Signed in successfully. Redirecting...", 2000);
      setTimeout(() => {
        // Portal resolves the account from the auth session — no URL ids passed.
        window.location.href = "/candidate/portal";
      }, 800);

    } catch (err) {
      console.error("Login error:", err);
      showToast("error", "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toastColors = {
    success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    error:   "bg-red-500/15 border-red-500/30 text-red-300",
    info:    "bg-blue-500/15 border-blue-500/30 text-blue-300",
  };

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-indigo-400">
            <Brain size={14} />
            <span className="font-semibold uppercase tracking-wider">PivotOps · Candidate Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sign In</h1>
          <p className="text-zinc-400 text-sm">Access your compliance credential portal.</p>
        </div>

        {toast && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${toastColors[toast.type]}`}>
            {toast.type === "success" ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Mail size={11} /> Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="jane@email.com" className={inputCls} autoComplete="email" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5"><Lock size={11} /> Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Your password" className={inputCls + " pr-10"} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPass(o => !o)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {attempts > 0 && attempts < 5 && (
            <p className="text-xs text-amber-400">{5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} remaining before temporary lockout.</p>
          )}

          <button onClick={handleLogin} disabled={loading || locked}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition">
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {locked ? "Locked — please wait" : loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-700">
          Don&apos;t have an account?{" "}
          <a href={`/candidate/register?candidateId=${candidateId}&tenantId=${tenantId}`}
            className="text-indigo-400 hover:text-indigo-300 transition">Register here</a>
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
    setTenantId(p.get("tenantId") ?? "default");
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-zinc-500" />
    </div>
  );
  return <LoginForm candidateId={candidateId} tenantId={tenantId} />;
}

export default function Page() {
  return <ParamsReader />;
}
