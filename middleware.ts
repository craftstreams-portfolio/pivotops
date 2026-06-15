import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
const PUBLIC_ROUTES = ["/login","/candidate/login","/candidate/register","/candidate/portal","/applications"];
const PUBLIC_API_PREFIXES = ["/api/recruitment/apply","/api/auth/callback","/api/auth/signout","/api/health"];
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", ["default-src 'self'","script-src 'self' 'unsafe-inline' 'unsafe-eval'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https:","font-src 'self'","connect-src 'self' https://*.supabase.co wss://*.supabase.co","frame-ancestors 'none'"].join("; "));
  return response;
}
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$/)) return NextResponse.next();
  const isPublicPage = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublicPage || isPublicApi) return applySecurityHeaders(NextResponse.next());
  const isDashboard = pathname.startsWith("/dashboard");
  const isProtectedApi = pathname.startsWith("/api") && !isPublicApi;
  if (!isDashboard && !isProtectedApi) return applySecurityHeaders(NextResponse.next());
  let response = NextResponse.next({ request: { headers: req.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value)); response = NextResponse.next({ request: req }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (isProtectedApi) return applySecurityHeaders(NextResponse.json({ error: "Authentication required." }, { status: 401 }));
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }
  return applySecurityHeaders(response);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };