# PivotOps — status enforcement, part 2 of 2
#
#   app\login\page.tsx             — signs out non-active users, no redirect loop
#   app\api\team\invites\route.ts  — a suspended admin can't send invites
#
# Run from the repo root:  .\apply-status-enforcement-2.ps1

cd "C:\Users\BAB AL SAFA\pivotops"

New-Item -ItemType Directory -Force -Path ".status-backup" | Out-Null
foreach ($f in @("app\login\page.tsx","app\api\team\invites\route.ts")) {
  if (Test-Path $f) { Copy-Item $f (".status-backup\" + ($f -replace "\\","__")) -Force }
}
Write-Host "Backed up to .status-backup\" -ForegroundColor Cyan

# ═════════════════════════════════════════════════════════════════════════════
# 1. app\api\team\invites\route.ts
# ═════════════════════════════════════════════════════════════════════════════
@'
import { getApiAuth, unauthorized } from "@/lib/auth/apiAuth";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { TeamInviteSchema } from "@/lib/security/schemas";
import { seatCapForPlan, planLabel, isSeatExempt } from "@/lib/billing/config";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * The tenant's paid tier. `subscriptions` is authoritative — it is what every
 * feature gate in the app reads — with tenants.plan as a fallback for rows
 * predating the subscriptions table.
 */
async function resolvePlan(admin: ReturnType<typeof getAdmin>, tenantId: string): Promise<string> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (sub?.plan) {
    // A cancelled or past-due subscription falls back to free-tier seats.
    const live = sub.status === "active" || sub.status === "trialing";
    return live ? sub.plan : "free";
  }

  const { data: tenantRow } = await admin
    .from("tenants").select("plan").eq("id", tenantId).maybeSingle();
  return tenantRow?.plan ?? "free";
}

async function getAuthedUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const parsed = TeamInviteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid invite request." }, { status: 400 });
    const { email, role, position } = parsed.data;

    const admin = getAdmin();

    const { data: actorProfile } = await admin.from("profiles").select("tenant_id, role, status").eq("id", user.id).maybeSingle();
    if (!actorProfile?.tenant_id) return NextResponse.json({ error: "No workspace found for your account." }, { status: 404 });

    // Suspending or deactivating someone does not invalidate their session
    // token, so authority is checked against live status, not the token.
    if (actorProfile.status && actorProfile.status !== "active") {
      return NextResponse.json({ error: "Your access has been revoked." }, { status: 403 });
    }

    if (!["admin", "manager"].includes(actorProfile.role ?? "")) {
      return NextResponse.json({ error: "Only admins and managers can invite teammates." }, { status: 403 });
    }

    const tenantId = actorProfile.tenant_id;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin.from("team_invites").select("id", { count: "exact", head: true }).eq("invited_by", user.id).gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 30) {
      return NextResponse.json({ error: "Too many invites sent recently. Please try again in a while." }, { status: 429 });
    }

    const plan = await resolvePlan(admin, tenantId);
    const cap  = isSeatExempt(tenantId) ? 999999 : seatCapForPlan(plan);
    const emailNorm = email.trim().toLowerCase();

    // Re-inviting someone who was deactivated is expected: their seat was
    // released, and reserve_team_invite_seat recycles the existing invite row.
    const { data: reserveResult, error: reserveErr } = await admin.rpc("reserve_team_invite_seat", {
      p_tenant_id: tenantId,
      p_email: emailNorm,
      p_role: role,
      p_invited_by: user.id,
      p_cap: cap,
    });

    if (reserveErr) {
      return NextResponse.json({ error: reserveErr.message }, { status: 500 });
    }
    if (!reserveResult?.ok) {
      return NextResponse.json({
        error: `Seat limit reached. ${planLabel(plan)} includes ${cap} seat${cap === 1 ? "" : "s"}, all currently used or pending. Deactivate a teammate who has left to free their seat, or upgrade your plan in Settings.`,
        code: "SEAT_LIMIT",
        plan, cap, used: reserveResult?.used ?? cap,
      }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email: emailNorm,
      options: {
        data: { tenant_id: tenantId, role, position: position ?? null, invited: true },
        redirectTo: baseUrl + "/login",
      },
    });

    if (linkErr || !linkData) {
      await admin.from("team_invites").delete().eq("tenant_id", tenantId).eq("email_normalized", emailNorm).eq("status", "pending");
      return NextResponse.json({ error: linkErr?.message ?? "Failed to generate invite link." }, { status: 500 });
    }

    const inviteLink = linkData.properties?.action_link ?? "";

    await admin.from("team_invites").update({ invite_link: inviteLink }).eq("tenant_id", tenantId).eq("email_normalized", emailNorm);

    const html = '<div style="background:#f4f4f5;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;"><div style="padding:32px 32px 20px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#10b981;">PivotOps</div><div style="font-size:10px;letter-spacing:1.5px;color:#a1a1aa;text-transform:uppercase;margin-top:4px;">Autonomous Workforce OS</div></div><div style="border-top:1px solid #e4e4e7;"></div><div style="padding:32px;color:#3f3f46;font-size:14px;line-height:1.6;"><h2 style="color:#18181b;font-size:20px;margin:0 0 12px;">You have been invited</h2><p style="margin:0 0 24px;">You have been invited to join a team on PivotOps as <strong>' + role + '</strong>. Accept the invitation to set up your account.</p><div style="text-align:center;margin:0 0 8px;"><a href="' + inviteLink + '" style="background:#10b981;color:#ffffff;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;display:inline-block;">Accept Invitation</a></div></div><div style="border-top:1px solid #e4e4e7;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:11px;color:#a1a1aa;">If you were not expecting this invitation, you can safely ignore this email.</p></div></div></div>';

    const emailResult = await sendEmail({ to: emailNorm, subject: "You've been invited to join PivotOps", html });

    await logAudit({ action: "TEAM_INVITE_SENT", actorId: user.id, actorName: user.email ?? user.id, entityType: "team_invite", entityId: emailNorm, metadata: { tenantId, role, emailSent: emailResult.ok } });

    return NextResponse.json({ success: true, inviteLink, emailSent: emailResult.ok });
  } catch (err) {
    console.error("Team invite error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send invite." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ route: "/api/team/invites", status: "ok" });
}
'@ | Set-Content -Path "app\api\team\invites\route.ts" -Encoding UTF8
Write-Host "  app\api\team\invites\route.ts" -ForegroundColor Green

# ═════════════════════════════════════════════════════════════════════════════
# 2. app\login\page.tsx
# ═════════════════════════════════════════════════════════════════════════════
@'
"use client";

import { useState, useEffect, Suspense } from "react";
import { isValidEmail } from "@/lib/validation";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acceptTeamInvite } from "@/lib/auth/acceptInvite";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING LOGIC — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
interface RoutingResult {
  destination: "dashboard" | "onboarding" | "error";
  reason: string;
}

// Shown when middleware bounces a non-active user back here, and when the
// status check below signs one out.
const ACCESS_MESSAGES: Record<string, string> = {
  suspended:   "Your access has been suspended. Contact your workspace admin to have it restored.",
  deactivated: "Your access to this workspace has been removed. Contact your workspace admin if you believe this is a mistake.",
};

function accessMessage(status: string): string {
  return ACCESS_MESSAGES[status] ?? "Your access to this workspace is not currently active. Contact your workspace admin.";
}

async function resolvePostLoginRoute(user: { id: string; email?: string | null; user_metadata?: any }): Promise<RoutingResult> {
  const userId = user.id;
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, tenant_id, onboarding_complete, onboarding_step, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    console.error("[routing] Profile fetch failed:", profileErr.message);
    return { destination: "error", reason: profileErr.message };
  }

  const meta = user.user_metadata ?? {};

  // Invited teammate: accepted server-side by accept_team_invite(), which
  // writes the profile (tenant, role, org fields, onboarding flags) and flips
  // the invite to accepted atomically. This no longer depends on
  // user_metadata.invited being present, so invites work regardless of how the
  // user arrived — magic link, verification link, or plain signup.
  //
  // This runs BEFORE the status check on purpose: re-inviting someone who was
  // deactivated is how they are brought back, and accept_team_invite() sets
  // their status to active. Checking status first would lock them out forever.
  const needsInviteCheck =
    !profile ||
    !profile.tenant_id ||
    profile.status === "deactivated" ||
    (meta.invited && meta.tenant_id && profile.tenant_id !== meta.tenant_id);

  if (needsInviteCheck) {
    const invite = await acceptTeamInvite(supabase);
    if (invite.ok) {
      return { destination: "dashboard", reason: "invited_teammate_joined" };
    }
    // "no_pending_invite" is the normal case for owners and returning users —
    // fall through to the checks below.
  }

  // Suspended or deactivated with no pending invite: the session token is still
  // valid, so sign them out here rather than letting middleware bounce them
  // back to this page in a loop.
  if (profile?.status && profile.status !== "active") {
    await supabase.auth.signOut();
    return { destination: "error", reason: "access_" + profile.status };
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
  const [error,    setError]    = useState(() => {
    const blocked = searchParams.get("access");
    return blocked ? accessMessage(blocked) : "";
  });
  const [success,  setSuccess]  = useState("");

  // Middleware sends a non-active user here with ?access=<status>. Their token
  // is still valid, so clear it — otherwise the next navigation bounces back.
  useEffect(() => {
    if (searchParams.get("access")) {
      supabase.auth.signOut().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper: route after auth, respecting ?redirect= when it points to dashboard ──
  // A SHOPLINE claim (Entry B) arrives here in the URL from the verification link.
  // Carry it forward to /onboarding as a query param — the URL is the only carrier
  // that survives new tabs and devices.
  function routeAfterAuth(result: RoutingResult) {
    const claim = searchParams.get("shopline_claim");
    const redirectTo = searchParams.get("redirect");

    if (result.destination === "dashboard") {
      // Only honor redirect param if it's a safe internal dashboard path
      if (redirectTo && redirectTo.startsWith("/dashboard")) {
        router.replace(redirectTo);
      } else {
        router.replace("/dashboard");
      }
    } else if (result.destination === "onboarding") {
      router.replace(claim ? `/onboarding?shopline_claim=${encodeURIComponent(claim)}` : "/onboarding");
    } else if (result.reason.startsWith("access_")) {
      setError(accessMessage(result.reason.slice("access_".length)));
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

    // Already bounced here by middleware — the signOut above handles it.
    if (searchParams.get("access")) return;

    // Hardened session check — getSession() returns null on Edge/Safari
    // on first load due to cookie timing. getUser() forces a server
    // round-trip and is always accurate regardless of browser.
    const getReliableUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return session.user;
      const { data: { user } } = await supabase.auth.getUser();
      return user ?? null;
    };
    getReliableUser().then(async (user) => {
      if (cancelled || !user) return;
      const result = await resolvePostLoginRoute(user);
      if (!cancelled) routeAfterAuth(result);
    });

    // An invite / magic link arrives with the session token in the URL. The
    // Supabase client parses it asynchronously AFTER mount, so the one-shot
    // check above sees no user yet. Listen for the session to be established
    // (SIGNED_IN) and route the invited teammate into their tenant then.
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const result = await resolvePostLoginRoute(session.user);
        if (!cancelled) routeAfterAuth(result);
      }
    });

    return () => { cancelled = true; authSub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (!email || !password) return;
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = normalizeEmail(email);

      if (mode === "signup") {
        // Check both email and email_normalized to catch case variations
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .or(`email_normalized.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
          .maybeSingle();

        if (existing) {
          setError("An account with this email already exists. Please sign in instead.");
          setMode("login");
          setLoading(false);
          return;
        }

        // Carry a SHOPLINE claim token (Entry B) INSIDE the verification link.
        // The merchant opens that link in a new tab / another device, where neither
        // sessionStorage nor localStorage is available, so the URL is the only
        // reliable carrier.
        const claim =
          new URLSearchParams(window.location.search).get("shopline_claim") ||
          localStorage.getItem("shopline_claim");
        const emailRedirectTo =
          `${window.location.origin}/onboarding` +
          (claim ? `?shopline_claim=${encodeURIComponent(claim)}` : "");

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo },
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

        // Supabase returns a user with an EMPTY identities[] array when the email
        // is already registered (it does NOT throw an error in this case).
        // Detect that and route them to sign in instead of creating a bogus
        // verification row pointing at an unusable user id.
        if (signUpData.user && (signUpData.user.identities?.length ?? 0) === 0) {
          setError("An account with this email already exists. Please sign in instead.");
          setMode("login");
          setLoading(false);
          return;
        }

        const newUserId = signUpData.user?.id;
        if (!newUserId) {
          setError("Account creation failed — no user returned.");
          setLoading(false);
          return;
        }

        // An invited teammate signing up with a password already has a pending
        // invite row. Accept it now, while the signUp session is still live,
        // and send them straight to the dashboard — they do not need the
        // owner verification chain.
        if (signUpData.session) {
          const invite = await acceptTeamInvite(supabase);
          if (invite.ok) {
            router.replace("/dashboard");
            return;
          }
        }

        // Send verification via Resend (bypasses flaky Supabase SMTP)
        const verifRes = await fetch("/api/owner/send-verification", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ authUserId: newUserId, email: normalizedEmail, fullName: "", shopline_claim: claim ?? undefined }),
        });
        const verifData = await verifRes.json();
        if (!verifRes.ok) {
          setError(verifData?.error ?? "Account created but verification email failed. Contact support@pivotops.app.");
          setLoading(false);
          return;
        }

        // Sign out so they must verify before setup
        if (signUpData.session) {
          await supabase.auth.signOut();
        }

        setSuccess("Account created. Check your email to verify, then sign in to start workspace setup.");
        setMode("login");

      } else {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInErr) { setError(signInErr.message); setLoading(false); return; }
        if (!signInData.user) { setError("Login failed. Please try again."); setLoading(false); return; }

        const result = await resolvePostLoginRoute(signInData.user);
        routeAfterAuth(result);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (otpErr) { setError(otpErr.message); setLoading(false); return; }
      setSuccess("Check your email for a sign-in link. It works even if you never set a password — useful for invited teammates.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
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
              <button
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="text-xs text-zinc-600 hover:text-emerald-400 transition disabled:opacity-40">
                Email me a sign-in link
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
'@ | Set-Content -Path "app\login\page.tsx" -Encoding UTF8
Write-Host "  app\login\page.tsx" -ForegroundColor Green

Write-Host "`nRunning tsc..." -ForegroundColor Cyan
npx tsc --noEmit
