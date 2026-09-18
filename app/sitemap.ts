import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/config";

/**
 * app/sitemap.ts
 *
 * Next.js generates /sitemap.xml from this automatically. Scoped to
 * confirmed-public, static marketing and legal content only. Deliberately
 * excludes every functional, authenticated, or tokenized route (admin,
 * onboarding, candidate portal, Shopify OAuth flows, e-signature links) -
 * none of those belong in search results, and several (admin/[token],
 * sign/[token]) would expose sensitive URL patterns if listed.
 *
 * /apply/[slug] (per-tenant job application pages) is intentionally left
 * OUT of this static list even though it is public-facing - it's dynamic
 * per tenant and has no fixed set of URLs to enumerate here. It stays
 * crawlable via robots.txt for anyone who lands on a specific link, just
 * not proactively listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/",                          priority: 1.0, changeFrequency: "weekly"  },
    { path: "/contact",                   priority: 0.7, changeFrequency: "monthly" },
    { path: "/legal/privacy",             priority: 0.3, changeFrequency: "yearly"  },
    { path: "/legal/refunds",             priority: 0.3, changeFrequency: "yearly"  },
    { path: "/legal/security",            priority: 0.3, changeFrequency: "yearly"  },
    { path: "/legal/terms",               priority: 0.3, changeFrequency: "yearly"  },
    { path: "/legal/shopline-faq",        priority: 0.3, changeFrequency: "yearly"  },
    { path: "/legal/shopline-privacy",    priority: 0.3, changeFrequency: "yearly"  },
  ];

  return staticPages.map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}