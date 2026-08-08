import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROLES = ["admin", "manager", "recruiter", "operator"] as const;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getAuthedUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Update a teammate's role or job title.
 *
 * RLS on profiles only permits a user to update their OWN row, so an admin
 * editing a teammate has to come through here. Authority is checked server-side:
 * the caller must be an admin/manager in the SAME tenant as the target.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { memberId, role, position } = await req.json();
    if (!memberId) return NextResponse.json({ error: "Missing member." }, { status: 400 });
    if (role && !ROLES.includes(role)) {
      return NextResponse.json({ error: "Unknown role." }, { status: 400 });
    }

    const admin = getAdmin();

    const { data: actor } = await admin
      .from("profiles").select("tenant_id, role").eq("id", user.id).maybeSingle();
    if (!actor?.tenant_id) return NextResponse.json({ error: "No workspace found." }, { status: 404 });
    if (!["admin", "manager"].includes(actor.role ?? "")) {
      return NextResponse.json({ error: "Only admins and managers can edit teammates." }, { status: 403 });
    }

    const { data: target } = await admin
      .from("profiles").select("id, tenant_id, role").eq("id", memberId).maybeSingle();
    if (!target) return NextResponse.json({ error: "Teammate not found." }, { status: 404 });
    if (target.tenant_id !== actor.tenant_id) {
      return NextResponse.json({ error: "That teammate is not in your workspace." }, { status: 403 });
    }

    // Only an admin may grant or revoke admin — a manager can't promote someone
    // (or themselves) past their own level.
    if (role && (role === "admin" || target.role === "admin") && actor.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can change admin access." }, { status: 403 });
    }

    // Don't let the last admin in a tenant be demoted out of existence.
    if (target.role === "admin" && role && role !== "admin") {
      const { count } = await admin
        .from("profiles").select("id", { count: "exact", head: true })
        .eq("tenant_id", actor.tenant_id).eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "This is the only admin — promote someone else first." }, { status: 400 });
      }
    }

    const patch: Record<string, any> = {};
    if (role) patch.role = role;
    if (position !== undefined) patch.position = String(position ?? "").trim().slice(0, 60) || null;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await admin.from("profiles").update(patch).eq("id", memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[team/members]", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}