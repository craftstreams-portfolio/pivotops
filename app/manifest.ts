import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/config";

/**
 * app/manifest.ts
 *
 * Next.js generates /manifest.webmanifest from this automatically - enables
 * "Add to Home Screen" on mobile with the real PivotOps mark rather than a
 * generic browser icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: "Automate hiring, onboarding, compliance, and team coordination in one system.",
    start_url: "/",
    display: "standalone",
    background_color: "#06070D",
    theme_color: "#06070D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}