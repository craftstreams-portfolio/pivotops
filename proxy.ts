import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/login", "/onboarding", "/candidate/login",
  "/candidate/register", "/candidate/portal",
  "/applications", "/apply",
];
const PUBLIC_API_PREFIXES = [
  "/api/recruitment/apply", "/api/auth/callback",
  "/api/auth/signout", "/api/health",
  "/api/public/tenant-lookup", "/api/dashboard/metrics",
];

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
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

  // Public routes — no auth check needed
  const isPublicPage = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublicPage || isPublicApi) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Only protect /dashboard and /api routes
  const isDashboard    = pathname.startsWith("/dashboard");
  const isProtectedApi = pathname.startsWith("/api") && !isPublicApi;

  if (!isDashboard && !isProtectedApi) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Auth check via cookie — Edge-compatible, no Node.js APIs
  const token =
    req.cookies.get("sb-access-token")?.value ||
    req.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`)?.value;

  // Verify session by calling Supabase REST directly (Edge-safe, no @supabase/ssr)
  let authenticated = false;
  if (token) {
    try {
      const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization:  `Bearer ${token}`,
          apikey:         supabaseAnon,
        },
      });
      authenticated = res.ok;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    if (isProtectedApi) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Authentication required." }, { status: 401 })
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};