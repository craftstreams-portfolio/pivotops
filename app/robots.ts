import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/config";

/**
 * app/robots.ts
 *
 * Next.js generates /robots.txt from this automatically. Every functional,
 * authenticated, or tokenized route is explicitly disallowed - default to
 * blocking anything not confirmed as public marketing content.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",           // token-gated admin backdoor - never crawlable
        "/sign/",            // e-signature links - tokenized, sensitive
        "/auth/callback",    // OAuth callback, not content
        "/onboarding",       // functional signup flow
        "/onboarding/verify",
        "/shopify/claim",    // Shopify OAuth flows built this session
        "/shopify/link",
        "/candidate/login",  // authenticated candidate area, no SEO value
        "/candidate/register",
        "/candidate/portal",
        "/candidate/verify",
        "/replay",           // internal/unclear purpose - default to blocked
        "/tasks",            // unclear if public marketing or internal - confirm and promote if public
        "/workforce",        // same
        "/api/",             // never index API routes
        "/dashboard/",       // authenticated app, never crawlable
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}