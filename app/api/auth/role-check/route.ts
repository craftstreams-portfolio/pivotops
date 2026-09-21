import { NextRequest, NextResponse } from "next/server";
import { withSecurity } from "@/lib/security/withSecurity";
import { RATE_LIMITS } from "@/lib/security/rateLimit";
import { Role, hasPermission } from "@/lib/auth/rbac";
export const GET = withSecurity(
  async (req) => {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") as Role;
    const permission = searchParams.get("permission") as any;
    if (!role || !permission) return NextResponse.json({ error: "Missing role or permission" }, { status: 400 });
    return NextResponse.json({ role, permission, allowed: hasPermission(role, permission) });
  },
  { requireAuth: true, rateLimit: RATE_LIMITS.authenticated }
);