/**
 * lib/security/withSecurity.ts
 * Single higher-order wrapper that applies:
 *   1. Rate limiting
 *   2. Optional session auth + tenant resolution
 *   3. Zod body validation
 *
 * Usage:
 *   export const POST = withSecurity(
 *     async (req, ctx) => { ... ctx.auth, ctx.body ... },
 *     { schema: ApplySchema, rateLimit: RATE_LIMITS.public, requireAuth: false }
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { checkRateLimit, RateLimitConfig, RATE_LIMITS } from "./rateLimit";
import { validateSession, getClientIp, AuthResult } from "./apiAuth";
import { logger } from "../logger";

export interface SecurityOptions<T = unknown> {
  /** Zod schema to validate request body (POST/PUT/PATCH only) */
  schema?: ZodSchema<T>;
  /** Rate limit config — defaults to authenticated */
  rateLimit?: RateLimitConfig;
  /** Require a valid session — defaults to true */
  requireAuth?: boolean;
  /** Minimum role required — checked against profile role */
  requireRole?: string[];
}

export interface RouteContext<T = unknown> {
  auth: AuthResult | null;
  body: T;
}

type RouteHandler<T> = (
  req: NextRequest,
  ctx: RouteContext<T>
) => Promise<NextResponse> | NextResponse;

export function withSecurity<T = unknown>(
  handler: RouteHandler<T>,
  options: SecurityOptions<T> = {}
) {
  const {
    schema,
    rateLimit = RATE_LIMITS.authenticated,
    requireAuth = true,
    requireRole,
  } = options;

  return async function securedRoute(req: NextRequest): Promise<NextResponse> {
    const ip = getClientIp(req);
    const routeKey = `${ip}:${req.nextUrl.pathname}`;

    // ── 1. RATE LIMIT ──────────────────────────────
    const rl = checkRateLimit(routeKey, rateLimit);
    if (!rl.allowed) {
      logger.warn("Rate limit exceeded", { ip, path: req.nextUrl.pathname });
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rl.resetAt),
          },
        }
      );
    }

    // ── 2. AUTH ────────────────────────────────────
    let auth: AuthResult | null = null;
    if (requireAuth) {
      auth = await validateSession(req);
      if (!auth) {
        logger.warn("Unauthenticated request", { ip, path: req.nextUrl.pathname });
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }

      // Role check
      if (requireRole && !requireRole.includes(auth.role)) {
        logger.warn("Insufficient role", {
          userId: auth.userId,
          role: auth.role,
          required: requireRole,
          path: req.nextUrl.pathname,
        });
        return NextResponse.json(
          { error: "Insufficient permissions." },
          { status: 403 }
        );
      }
    }

    // ── 3. BODY VALIDATION ─────────────────────────
    let body: T = {} as T;
    const method = req.method.toUpperCase();

    if (schema && ["POST", "PUT", "PATCH"].includes(method)) {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body." },
          { status: 400 }
        );
      }

      const result = schema.safeParse(raw);
      if (!result.success) {
        const issues = (result.error as ZodError).issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }));
        return NextResponse.json(
          { error: "Validation failed.", issues },
          { status: 422 }
        );
      }
      body = result.data;
    }

    // ── 4. HANDLER ─────────────────────────────────
    try {
      return await handler(req, { auth, body });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error("Unhandled route error", {
        path: req.nextUrl.pathname,
        method,
        error: message,
        userId: auth?.userId,
      });
      return NextResponse.json(
        { error: "An internal error occurred. It has been logged." },
        { status: 500 }
      );
    }
  };
}