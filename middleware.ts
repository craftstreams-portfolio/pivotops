import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const isDev = process.env.NODE_ENV === "development";

// ── Rate limit store (edge-compatible, resets on cold start) ────────────────
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function getRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

const PUBLIC_RATE_LIMITED = [
  "/candidate/register",
  "/candidate/login",
  "/login",
  "/api/public/tenant-lookup",
];

// ── Routes that require a valid session ─────────────────────────────────────
// Checked server-side in middleware so no browser can bypass the gate.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/tasks",
  "/workforce",
  "/replay",
];

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");

  if (!isDev) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("X-XSS-Protection", "1; mode=block");

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com";

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "object-src 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.anthropic.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
      "frame-ancestors 'self' https://*.myshopline.com https://*.shopline.com",
      "base-uri 'self'",
      "form-action 'self'",
      ...(!isDev ? ["upgrade-insecure-requests"] : []),
    ].join("; ")
  );

  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets — pass through immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Rate limit public endpoints
  const isRateLimited = PUBLIC_RATE_LIMITED.some(p => pathname.startsWith(p));
  if (isRateLimited) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    if (!getRateLimit(ip, 100, 60_000)) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60", "X-Content-Type-Options": "nosniff" },
      });
    }
  }

  // ── Server-side auth gate ────────────────────────────────────────────────
  // Runs before the page renders — no browser behaviour can bypass this.
  // Uses @supabase/ssr so the session cookie is read from the request headers
  // the same way on every browser including Edge.
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  if (isProtected) {
    const res = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Candidates belong in their own portal, not the owner dashboard.
    if (pathname.startsWith("/dashboard") && user.user_metadata?.role === "candidate") {
      const portalUrl = req.nextUrl.clone();
      portalUrl.pathname = "/candidate/portal";
      return NextResponse.redirect(portalUrl);
    }

    return applySecurityHeaders(res);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};