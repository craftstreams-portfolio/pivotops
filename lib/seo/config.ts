import type { Metadata } from "next";

/**
 * lib/seo/config.ts
 *
 * Centralized metadata source. Every page should build its metadata from
 * here rather than hardcoding title/description/OG tags individually, so
 * brand name, site URL, and social handles only ever need changing in one
 * place.
 */

// NEXT_PUBLIC_APP_URL is set to localhost in .env.local for local dev.
// Production must resolve to the real domain regardless of that local value.
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://www.pivotops.app";

export const SITE_NAME = "PivotOps";
export const SITE_TAGLINE = "Autonomous Workforce OS";
export const SITE_DESCRIPTION =
  "Automate hiring, onboarding, compliance, and team coordination in one system. PivotOps replaces fragmented staffing tools with a single AI-powered workforce operations platform.";
export const PUBLISHER = "Craftstreams Technologies";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;              // e.g. "/contact" or "/" for homepage
  ogImage?: string;           // absolute URL; falls back to DEFAULT_OG_IMAGE
  noIndex?: boolean;          // true for pages that should never be indexed
}

/**
 * Build a full Metadata object for one page. Call this from that page's
 * exported `metadata` (or `generateMetadata`), passing only what's specific
 * to that page — everything else (OG type, site name, robots defaults,
 * theme color, etc.) is filled in consistently here.
 */
export function buildMetadata(input: PageMetadataInput): Metadata {
  const url = `${SITE_URL}${input.path === "/" ? "" : input.path}`;
  const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
  const fullTitle = input.path === "/" ? input.title : `${input.title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description: input.description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    authors: [{ name: PUBLISHER }],
    publisher: PUBLISHER,
    applicationName: SITE_NAME,
    referrer: "strict-origin-when-cross-origin",
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description: input.description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: input.description,
      images: [ogImage],
    },
  };
}

/** JSON-LD Organization schema - used once, on the homepage. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    legalName: PUBLISHER,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
    sameAs: [] as string[], // add social profile URLs here once they exist
  };
}

/** JSON-LD WebSite schema - used once, on the homepage. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

/** JSON-LD SoftwareApplication schema - used once, on the homepage. */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "1500",
      highPrice: "6000",
      offerCount: "3",
    },
  };
}