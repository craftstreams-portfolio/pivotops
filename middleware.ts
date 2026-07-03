import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// Rate limit store (edge-compatible, resets on cold start)
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

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");

  // HSTS only in production — breaks localhost in dev
  if (!isDev) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // CSP: allow unsafe-eval in dev (React needs it), block in production
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com";

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets — pass through immediately
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Rate limit public endpoints (100 req/min per IP)
  const isRateLimited = PUBLIC_RATE_LIMITED.some(p => pathname.startsWith(p));
  if (isRateLimited) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    if (!getRateLimit(ip, 100, 60_000)) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-Content-Type-Options": "nosniff",
        }
      });
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};