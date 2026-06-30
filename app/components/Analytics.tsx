"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = "pivotops_cookie_consent"; // "granted" | "denied"

declare global {
  interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[]; }
}

export function trackEvent(name: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

export default function Analytics() {
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    try {
      const saved = document.cookie
        .split("; ")
        .find((c) => c.startsWith(CONSENT_KEY + "="))
        ?.split("=")[1];
      if (saved === "granted" || saved === "denied") setConsent(saved);
    } catch { /* ignore */ }
  }, []);

  const choose = (value: "granted" | "denied") => {
    setConsent(value);
    try {
      document.cookie = `${CONSENT_KEY}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch { /* ignore */ }
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: value,
        ad_storage: "denied",
      });
    }
  };

  // No GA configured -> render nothing
  if (!GA_ID) return null;

  return (
    <>
      {/* Consent Mode default (denied) must load before GA */}
      <Script id="ga-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>

      {/* Load GA only once we have any decision (consent update handles granted/denied) */}
      {consent && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
              gtag('consent', 'update', {
                analytics_storage: '${consent}',
                ad_storage: 'denied'
              });
            `}
          </Script>
        </>
      )}

      {/* Consent banner */}
      {consent === null && (
        <div style={{
          position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 9999,
          maxWidth: 520, margin: "0 auto", background: "#0B1D3A",
          border: "1px solid rgba(0,191,166,0.3)", borderRadius: 14,
          padding: "16px 18px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          fontFamily: "system-ui, sans-serif", color: "#fff",
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
        }}>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, flex: "1 1 240px", color: "#cbd5e1" }}>
            We use cookies for analytics to improve PivotOps. You can accept or decline.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => choose("denied")} style={{
              fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 9,
              background: "transparent", color: "#94a3b8", border: "1px solid #334155", cursor: "pointer",
            }}>Decline</button>
            <button onClick={() => choose("granted")} style={{
              fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 9,
              background: "#00BFA6", color: "#06070D", border: "none", cursor: "pointer",
            }}>Accept</button>
          </div>
        </div>
      )}
    </>
  );
}