"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING LOGIC — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
interface RoutingResult {
  destination: "dashboard" | "onboarding" | "error";
  reason: string;
}

async function resolvePostLoginRoute(user: { id: string; email?: string | null; user_metadata?: any }): Promise<RoutingResult> {
  const userId = user.id;
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, tenant_id, onboarding_complete, onboarding_step")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error("[routing] Profile fetch failed:", profileErr.message);
    return { destination: "error", reason: profileErr.message };
  }

  const meta = user.user_metadata ?? {};

  // Invited teammate: always (re)apply the invite's tenant/role, even if a
  // placeholder profile already exists (e.g. created by the auth.users
  // signup trigger), since that placeholder may carry a stale tenant_id.
  if (meta.invited && meta.tenant_id && (!profile || profile.tenant_id !== meta.tenant_id)) {
    const now = new Date().toISOString();
    const invitedEmail = normalizeEmail(user.email ?? "");
    const { data: tenantRow } = await supabase.from("tenants").select("org_name, org_size, org_industry, org_country").eq("id", meta.tenant_id).maybeSingle();
    await supabase.from("profiles").upsert({
      id: userId,
      email: invitedEmail,
      email_normalized: invitedEmail,
      tenant_id: meta.tenant_id,
      role: meta.role ?? "operator",
      org_name: tenantRow?.org_name ?? "",
      org_size: tenantRow?.org_size ?? "",
      org_industry: tenantRow?.org_industry ?? "",
      org_country: tenantRow?.org_country ?? "",
      onboarding_complete: true,
      first_login_at: now,
      date_joined: now.slice(0, 10),
      created_at: now,
      updated_at: now,
    }, { onConflict: "id" });
    await supabase.from("team_invites")
      .update({ status: "accepted", accepted_at: now })
      .eq("tenant_id", meta.tenant_id)
      .eq("email_normalized", invitedEmail);
    return { destination: "dashboard", reason: "invited_teammate_joined" };
  }

  if (!profile) {
    return { destination: "onboarding", reason: "no_profile" };
  }

  if (profile.onboarding_complete === true) {
    return { destination: "dashboard", reason: "onboarding_complete_flag" };
  }

  if (profile.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (tenant) {
      await supabase
        .from("profiles")
        .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
        .eq("id", userId);
      return { destination: "dashboard", reason: "tenant_exists_self_healed" };
    }
  }

  return { destination: "onboarding", reason: "no_tenant" };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// PIVOTOPS LOGO SVG — silver/chrome gradient (matches dashboard splash)
// ─────────────────────────────────────────────────────────────────────────────
function PivotOpsLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.87)}
      viewBox="0 0 100 87"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="chromeOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#d0d0d0" />
          <stop offset="35%"  stopColor="#ffffff" />
          <stop offset="65%"  stopColor="#909090" />
          <stop offset="100%" stopColor="#b8b8b8" />
        </linearGradient>
        <linearGradient id="chromeInner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#606060" />
          <stop offset="50%"  stopColor="#c8c8c8" />
          <stop offset="100%" stopColor="#484848" />
        </linearGradient>
      </defs>
      <path
        d="M50 3L97 84H3L50 3Z"
        fill="rgba(255,255,255,0.03)"
        stroke="url(#chromeOuter)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M50 24L80 75H20L50 24Z"
        fill="none"
        stroke="url(#chromeInner)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState<"login" | "signup" | "forgot">(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  // ── Helper: route after auth, respecting ?redirect= when it points to dashboard ──
  function routeAfterAuth(result: RoutingResult) {
    if (result.destination === "dashboard") {
      const redirectTo = searchParams.get("redirect");
      // Only honor redirect param if it's a safe internal dashboard path
      if (redirectTo && redirectTo.startsWith("/dashboard")) {
        router.replace(redirectTo);
      } else {
        router.replace("/dashboard");
      }
    } else if (result.destination === "onboarding") {
      router.replace("/onboarding");
    } else {
      setError("Something went wrong loading your account. Please try again or contact support.");
    }
  }

  // Auto-redirect if already authenticated (covers page refresh,
  // direct navigation to /login while already logged in)
  useEffect(() => {
    let cancelled = false;

    if (searchParams.get("mode") === "signup") {
      supabase.auth.signOut().catch(() => {});
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        const result = await resolvePostLoginRoute(session.user);
        if (!cancelled) routeAfterAuth(result);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = normalizeEmail(email);

      if (mode === "signup") {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("email_normalized", normalizedEmail)
          .maybeSingle();

        if (existing) {
          setError("An account with this email already exists. Please sign in instead.");
          setMode("login");
          setLoading(false);
          return;
        }

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/onboarding",
          },
        });

        if (signUpErr) {
          if (signUpErr.message.toLowerCase().includes("already registered")) {
            setError("An account with this email already exists. Please sign in instead.");
            setMode("login");
          } else {
            setError(signUpErr.message);
          }
          setLoading(false);
          return;
        }

        setSuccess("Account created. Check your email to verify your account, then you'll be taken straight to setup.");
        setMode("login");

      } else {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInErr) { setError(signInErr.message); setLoading(false); return; }
        if (!signInData.user) { setError("Login failed. Please try again."); setLoading(false); return; }

        const result = await resolvePostLoginRoute(signInData.user);
        console.log("[routing]", result);
        routeAfterAuth(result);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(email),
        { redirectTo: window.location.origin + "/auth/callback" }
      );
      if (resetErr) throw resetErr;
      setSuccess("Reset link sent — check your inbox. The link expires in 1 hour.");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally { setLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden
                    bg-zinc-950 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_65%)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px),
                            linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">

        {/* ── LOGO ── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-2xl bg-white/10 scale-150" />
            <PivotOpsLogo size={56} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">PivotOps</h1>
            <p className="text-xs text-zinc-500 font-medium tracking-widest uppercase mt-0.5">
              Autonomous Workforce OS
            </p>
          </div>
        </div>

        {/* ── CARD ── */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80
                        backdrop-blur-sm p-6 space-y-4 shadow-2xl shadow-black/40">

          <div className="text-center pb-1">
            <p className="text-sm text-zinc-400">
              {mode === "login" ? "Sign in to your account" : "Create your account"}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl
                            px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl
                            px-4 py-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-sm text-white placeholder-zinc-500 outline-none
                       focus:border-emerald-500 transition"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3
                       text-sm text-white placeholder-zinc-500 outline-none
                       focus:border-emerald-500 transition"
          />

          {mode === "login" && (
            <div className="flex justify-end -mt-1">
              <button
                onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                className="text-xs text-zinc-600 hover:text-indigo-400 transition">
                Forgot password?
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 text-center">
                Enter your email and we will send a password reset link.
              </p>
              <button
                onClick={handleForgotPassword}
                disabled={loading || !email}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                           py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Sending..." : "Send Reset Email"}
              </button>
              <button
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="w-full text-center text-xs text-zinc-500 hover:text-emerald-400 transition">
                Back to sign in
              </button>
            </div>
          )}

          {mode !== "forgot" && <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full bg-emerald-500 hover:opacity-90 text-zinc-950 font-semibold
                       py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Please wait..."
              : mode === "login" ? "Sign In" : "Create Account"
            }
          </button>}

          {mode !== "forgot" && <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setSuccess("");
            }}
            className="w-full text-center text-xs text-zinc-500 hover:text-emerald-400 transition"
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"
            }
          </button>}
        </div>

        <p className="text-center text-[10px] text-zinc-700 mt-6">
          Secured by PivotOps · All data encrypted in transit
        </p>
      </div>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LoginPage />
    </Suspense>
  );
}
