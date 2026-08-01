"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * app/shopify/link/page.tsx
 *
 * Landing page after a Shopify install when the browser already has a
 * PivotOps session. Never auto-links - shows who is signed in and which
 * store is being connected, and requires an explicit click before the two
 * are attached. Prevents a shared/public browser session from silently
 * having an unrelated store attached to it.
 *
 * ISOLATION: net-new page. Does not import from app/onboarding or app/login.
 */

function LinkConfirm() {
  const params = useSearchParams();
  const router = useRouter();
  const shop = params.get("shop") ?? "";
  const alreadyLinked = params.get("already_linked") === "1";

  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
      setChecking(false);
    });
  }, []);

  async function handleLink() {
    setError("");
    setLinking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");

      const res = await fetch("/api/shopify/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ shop }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to link your store.");

      setDone(true);
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLinking(false);
    }
  }

  const boxStyle: React.CSSProperties = {
    background: "#12141C", border: "1px solid #23262F", borderRadius: 14, padding: 24,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#06070D", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p style={{ color: "#00BFA6", fontSize: 20, fontWeight: 700, margin: 0 }}>PivotOps</p>
          <p style={{ color: "#8A8F9A", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>Connect your Shopify store</p>
        </div>

        {checking ? (
          <div style={{ ...boxStyle, textAlign: "center", color: "#8A8F9A", fontSize: 14 }}>Checking your session…</div>
        ) : !email ? (
          <div style={boxStyle}>
            <p style={{ color: "#fff", fontSize: 14, marginBottom: 8 }}>Your session could not be verified.</p>
            <p style={{ color: "#8A8F9A", fontSize: 13 }}>Please sign in, then reinstall from Shopify to link your store.</p>
          </div>
        ) : alreadyLinked ? (
          <div style={boxStyle}>
            <p style={{ color: "#fff", fontSize: 14 }}>
              <strong style={{ color: "#00BFA6" }}>{shop}</strong> is already connected to a PivotOps workspace.
            </p>
            <button onClick={() => router.replace("/dashboard")}
              style={{ marginTop: 16, background: "#00BFA6", color: "#04211E", fontWeight: 600, border: "none", borderRadius: 10, padding: "11px 0", width: "100%", fontSize: 14, cursor: "pointer" }}>
              Go to dashboard
            </button>
          </div>
        ) : done ? (
          <div style={{ ...boxStyle, textAlign: "center", color: "#00BFA6", fontSize: 14 }}>Store connected. Redirecting…</div>
        ) : (
          <div style={boxStyle}>
            <p style={{ color: "#8A8F9A", fontSize: 13, marginBottom: 4 }}>Signed in as</p>
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, marginBottom: 18 }}>{email}</p>

            <p style={{ color: "#8A8F9A", fontSize: 13, marginBottom: 4 }}>Link this store to your workspace</p>
            <p style={{ color: "#00BFA6", fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{shop || "(unknown store)"}</p>

            {error && <p style={{ color: "#FF5F56", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <button onClick={handleLink} disabled={linking || !shop}
              style={{ background: "#00BFA6", color: "#04211E", fontWeight: 600, border: "none", borderRadius: 10, padding: "12px 0", width: "100%", fontSize: 14, cursor: linking ? "default" : "pointer", opacity: linking ? 0.6 : 1 }}>
              {linking ? "Linking…" : `Link ${shop || "store"} to my workspace`}
            </button>

            <p style={{ color: "#5A606B", fontSize: 12, textAlign: "center", marginTop: 14 }}>
              Not you? Sign out and reinstall from Shopify with the right account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopifyLinkPage() {
  return (
    <Suspense fallback={null}>
      <LinkConfirm />
    </Suspense>
  );
}