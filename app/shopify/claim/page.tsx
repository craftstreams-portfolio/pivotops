"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * app/shopify/claim/page.tsx
 *
 * Landing page after a Shopify install when nobody is signed in. Collects a
 * new PivotOps account plus a company name, then hands off to
 * /api/shopify/claim to provision the tenant and link the install.
 *
 * ISOLATION: net-new page. Does not import from or route through
 * app/onboarding or app/login - builds its own minimal signup form so it
 * never depends on either flow's redirect logic.
 */

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ClaimForm() {
  const params = useSearchParams();
  const router = useRouter();
  const shop = params.get("shop") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [needsOrgName, setNeedsOrgName] = useState(false);

  // Returning here after clicking the email confirmation link - Supabase
  // establishes a session automatically. If one already exists, skip the
  // signup form and go straight to provisioning, rather than asking the
  // merchant to fill in an account that already exists.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && shop) {
        setNeedsOrgName(true); // still need company name, ask for just that
      }
      setCheckingSession(false);
    });
  }, [shop]);

  async function finishClaim(token: string) {
    if (!orgName.trim()) { setError("Please enter your company name."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/shopify/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ shop, orgName: orgName.trim(), fullName: fullName.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to connect your store.");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!shop) { setError("Missing shop information. Please reinstall from Shopify."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!orgName.trim()) { setError("Please enter your company name."); return; }

    setLoading(true);
    try {
      // Explicit emailRedirectTo so the confirmation link returns here with
      // the shop param intact, instead of falling back to the global Site URL
      // (the bare landing page) with an unhandled Supabase ?code= param.
      const redirectTarget = `${window.location.origin}/shopify/claim?shop=${encodeURIComponent(shop)}`;
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: redirectTarget,
        },
      });
      if (signUpErr) throw new Error(signUpErr.message);

      const token = signUpData.session?.access_token;
      if (!token) {
        // Email confirmation is required before a session exists - nothing to
        // provision yet. Tell the merchant to confirm, then come back to this
        // same URL (shop param preserved) to finish.
        setError("Check your email to confirm your account, then return to this page to finish connecting your store.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/shopify/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ shop, orgName: orgName.trim(), fullName: fullName.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to connect your store.");

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const boxStyle: React.CSSProperties = { background: "#12141C", border: "1px solid #23262F", borderRadius: 12, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#C9E8E2" };
  const inputStyle: React.CSSProperties = { background: "#12141C", border: "1px solid #23262F", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14 };
  const buttonStyle: React.CSSProperties = { background: "#00BFA6", color: "#04211E", fontWeight: 600, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, marginTop: 8 };

  return (
    <div style={{ minHeight: "100vh", background: "#06070D", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p style={{ color: "#00BFA6", fontSize: 20, fontWeight: 700, margin: 0 }}>PivotOps</p>
          <p style={{ color: "#8A8F9A", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>Connect your Shopify store</p>
        </div>

        {shop && !checkingSession && (
          <div style={boxStyle}>
            Connecting <strong style={{ color: "#00BFA6" }}>{shop}</strong>
          </div>
        )}

        {checkingSession ? (
          <p style={{ color: "#8A8F9A", fontSize: 14, textAlign: "center" }}>Checking your account…</p>

        ) : needsOrgName ? (
          // Returned here after clicking the email confirmation link — a
          // session already exists, just need the company name to finish.
          <form onSubmit={(e) => { e.preventDefault(); supabase.auth.getSession().then(({ data: { session } }) => { if (session?.access_token) finishClaim(session.access_token); }); }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#8A8F9A", fontSize: 13, marginBottom: -4 }}>Email confirmed. One more step:</p>
            <input placeholder="Company name" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} autoFocus />
            {error && <p style={{ color: "#FF5F56", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ ...buttonStyle, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Connecting..." : "Finish connecting store"}
            </button>
          </form>

        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
              <input placeholder="Company name" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />

              {error && <p style={{ color: "#FF5F56", fontSize: 13 }}>{error}</p>}

              <button type="submit" disabled={loading} style={{ ...buttonStyle, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Connecting..." : "Create account & connect store"}
              </button>
            </form>

            <p style={{ color: "#5A606B", fontSize: 12, textAlign: "center", marginTop: 20 }}>
              Already have a PivotOps account? Sign in first, then reinstall from Shopify to link it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ShopifyClaimPage() {
  return (
    <Suspense fallback={null}>
      <ClaimForm />
    </Suspense>
  );
}