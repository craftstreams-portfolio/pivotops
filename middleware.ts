import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  // Prevent clickjacking
  res.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");
  // HSTS — enforce HTTPS for 1 year including subdomains
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Cache control for sensitive routes
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  // XSS protection (legacy browsers)
  res.headers.set("X-XSS-Protection", "1; mode=block");
  // CSP — removed unsafe-eval, restricted img-src
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.anthropic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
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