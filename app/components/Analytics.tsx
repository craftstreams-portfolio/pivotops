"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = "pivotops_cookie_consent";

declare global {
  interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[]; }
}

export function trackEvent(name: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
}

function readAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.analytics === true;
  } catch {
    return false;
  }
}

// Loads GA4 only after the user grants analytics consent via the existing
// CookieConsent banner (stored in localStorage). No UI of its own.
export default function Analytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(readAnalyticsConsent());
    // Re-check when the banner writes consent (storage event fires across tabs;
    // we also poll briefly for same-tab updates right after a choice).
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) setAllowed(readAnalyticsConsent());
    };
    window.addEventListener("storage", onStorage);
    const iv = setInterval(() => {
      const now = readAnalyticsConsent();
      setAllowed((prev) => (prev !== now ? now : prev));
    }, 1500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(iv); };
  }, []);

  if (!GA_ID || !allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}