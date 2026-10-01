"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Handles magic-link and password-reset returns. The token arrives in the URL
 * hash, which only the browser can read, so this is a client page (not the
 * /api/auth/callback route, which handles the ?code= server exchange).
 *
 * On a valid session we resolve the user's tenant and route to the dashboard.
 * Invited teammates who signed in via magic link land in their workspace here.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    // Surface an explicit error (expired/used link) instead of a blank hang.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    const errCode = params.get("error_code") || search.get("error_code");
    if (errCode) {
      setMessage(
        errCode === "otp_expired"
          ? "This sign-in link has expired or was already used. Please request a new one."
          : "This link is invalid. Please request a new sign-in link."
      );
      setTimeout(() => { if (!cancelled) router.replace("/login"); }, 3500);
      return () => { cancelled = true; };
    }

    async function resolve(userId: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, tenant_id, onboarding_complete")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (profile?.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants").select("id").eq("id", profile.tenant_id).maybeSingle();
        if (tenant) { router.replace("/dashboard"); return; }
      }
      // No usable tenant yet — send them through onboarding rather than a dead end.
      router.replace(profile ? "/onboarding" : "/onboarding");
    }

    // The session may already be parsed, or arrive momentarily via the hash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) { resolve(session.user.id); return; }

      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (cancelled) return;
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s?.user) {
          resolve(s.user.id);
        }
      });
      // If nothing arrives, fall back to login rather than hang.
      setTimeout(() => {
        if (!cancelled) {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (!cancelled) { user ? resolve(user.id) : router.replace("/login"); }
          });
        }
      }, 4000);
      return () => sub.subscription.unsubscribe();
    });

    return () => { cancelled = true; };
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#06070D", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #00BFA6", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: "#aaa", fontSize: 14 }}>{message}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}