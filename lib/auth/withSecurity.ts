import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

export interface SecurityContext {
  userId:   string;
  tenantId: string;
  email:    string;
  role?:    string;
}

function supabaseFromRequest(req: NextRequest) {
  const cookies = req.cookies;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function validateSession(req: NextRequest): Promise<SecurityContext | null> {
  try {
    const sb = supabaseFromRequest(req);
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session?.user) return null;

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", session.user.id)
      .single();

    if (!profile?.tenant_id) return null;

    return {
      userId:   session.user.id,
      tenantId: profile.tenant_id,
      email:    session.user.email ?? "",
      role:     profile.role ?? "member",
    };
  } catch {
    return null;
  }
}

type RouteHandler = (
  req: NextRequest,
  ctx: SecurityContext,
  body?: unknown
) => Promise<NextResponse> | NextResponse;

interface SecurityOptions {
  schema?: z.ZodTypeAny;
  allowedRoles?: string[];
  rateLimit?: number; // requests per minute (not enforced here, handled at edge)
}

export function withSecurity(handler: RouteHandler, opts: SecurityOptions = {}) {
  return async function secured(req: NextRequest): Promise<NextResponse> {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const ctx = await validateSession(req);
    if (!ctx) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: securityHeaders() }
      );
    }

    // ── Role check ────────────────────────────────────────────────────────────
    if (opts.allowedRoles && opts.allowedRoles.length > 0) {
      if (!ctx.role || !opts.allowedRoles.includes(ctx.role)) {
        return NextResponse.json(
          { error: "Insufficient permissions." },
          { status: 403, headers: securityHeaders() }
        );
      }
    }

    // ── Body validation ───────────────────────────────────────────────────────
    let body: unknown;
    if (opts.schema && req.method !== "GET") {
      try {
        const raw = await req.json();
        body = opts.schema.parse(raw);
      } catch {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400, headers: securityHeaders() }
        );
      }
    }

    // ── Execute ───────────────────────────────────────────────────────────────
    try {
      const res = await handler(req, ctx, body);
      securityHeaders().forEach((v, k) => res.headers.set(k, v));
      return res;
    } catch (err) {
      console.error("[withSecurity] handler error:", err);
      return NextResponse.json(
        { error: "Internal server error." },
        { status: 500, headers: securityHeaders() }
      );
    }
  };
}

function securityHeaders(): Headers {
  const h = new Headers();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Cache-Control", "no-store, no-cache, must-revalidate");
  h.set("Pragma", "no-cache");
  return h;
}