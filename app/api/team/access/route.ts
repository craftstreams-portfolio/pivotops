import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ACTIONS = ["revoke_sessions", "disable", "suspend", "deactivate", "reinstate", "restore"] as const;
type Action = (typeof ACTIONS)[number];

// Reasons offered for security-sensitive actions. Free text is not accepted
// for the reason itself so the audit trail stays queryable; anything narrative
// belongs in notes.
const REASONS = ["internal_investigation", "security_incident", "credential_compromise", "policy_violation", "offboarding", "other"];

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

// Messages are deliberately generic. Internal error detail and investigation
// context never reach the client.
const REASON_MESSAGES: Record<string, string> = {
  no_session:         "Authentication required.",
  forbidden:          "You do not have permission to modify this employee's access.",
  not_found:          "That employee is not in your workspace.",
  cannot_act_on_self: "You cannot change your own access.",
  admin_only:         "Only an admin can change another admin's access.",
  last_admin:         "This employee is the last admin. Assign another admin before removing access.",
  invalid_action:     "Unknown action.",
  invalid_transition: "That change is not valid from this employee's current status.",
};

const STATUS_CODES: Record<string, number> = {
  no_session: 401, forbidden: 403, admin_only: 403, cannot_act_on_self: 403,
  not_found: 404, last_admin: 400, invalid_action: 400, invalid_transition: 400,
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { memberId, action, reason, notes } = await req.json();

    if (!memberId || typeof memberId !== "string") {
      return NextResponse.json({ error: "Missing employee." }, { status: 400 });
    }
    if (!ACTIONS.includes(action as Action)) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    if (reason && !REASONS.includes(reason)) {
      return NextResponse.json({ error: "Unknown reason." }, { status: 400 });
    }

    // Captured server-side. A client-supplied address would be worthless in an
    // audit trail.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip") ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 400) ?? null;

    // The service-role client makes auth.uid() null inside the function, so the
    // actor is passed explicitly — the id verified from the session cookie
    // above, never anything the client sent. All authorization, tenant
    // isolation and audit logging still happen inside set_employee_access.
    const admin = getAdmin();
    const { data, error } = await admin.rpc("set_employee_access", {
      p_user: memberId,
      p_action: action,
      p_reason: reason ?? null,
      p_notes: notes ? String(notes).slice(0, 1000) : null,
      p_actor: user.id,
      p_ip: ip,
      p_ua: ua,
    });

    if (error) {
      console.error("[team/access]", error.message);
      return NextResponse.json({ error: "Access state could not be updated." }, { status: 500 });
    }

    if (!data?.ok) {
      const code = STATUS_CODES[data?.reason] ?? 400;
      return NextResponse.json(
        { error: REASON_MESSAGES[data?.reason] ?? "Access state could not be updated.", reason: data?.reason },
        { status: code }
      );
    }

    return NextResponse.json({
      ok: true,
      status: data.status,
      noop: data.noop ?? false,
      sessionsRevoked: data.sessions_revoked,
      seatsUsed: data.seats_used,
    });
  } catch (e: any) {
    console.error("[team/access]", e);
    return NextResponse.json({ error: "Access state could not be updated." }, { status: 500 });
  }
}
