import { getApiAuth, unauthorized } from "@/lib/auth/apiAuth";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { TeamInviteSchema } from "@/lib/security/schemas";
import { sendEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseSeatCap(orgSize: string | null | undefined): number {
  if (!orgSize) return 5;
  const range = orgSize.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return parseInt(range[2], 10);
  if (orgSize.includes("+")) return Number.MAX_SAFE_INTEGER;
  return 5;
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const parsed = TeamInviteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid invite request." }, { status: 400 });
    const { email, role, position } = parsed.data;

    const admin = getAdmin();

    const { data: actorProfile } = await admin.from("profiles").select("tenant_id, role").eq("id", user.id).maybeSingle();
    if (!actorProfile?.tenant_id) return NextResponse.json({ error: "No workspace found for your account." }, { status: 404 });
    if (!["admin", "manager"].includes(actorProfile.role ?? "")) {
      return NextResponse.json({ error: "Only admins and managers can invite teammates." }, { status: 403 });
    }

    const tenantId = actorProfile.tenant_id;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin.from("team_invites").select("id", { count: "exact", head: true }).eq("invited_by", user.id).gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 30) {
      return NextResponse.json({ error: "Too many invites sent recently. Please try again in a while." }, { status: 429 });
    }

    const { data: tenantRow } = await admin.from("tenants").select("org_size").eq("id", tenantId).maybeSingle();
    const cap = parseSeatCap(tenantRow?.org_size);
    const emailNorm = email.trim().toLowerCase();

    const { data: reserveResult, error: reserveErr } = await admin.rpc("reserve_team_invite_seat", {
      p_tenant_id: tenantId,
      p_email: emailNorm,
      p_role: role,
      p_invited_by: user.id,
      p_cap: cap,
    });

    if (reserveErr) {
      return NextResponse.json({ error: reserveErr.message }, { status: 500 });
    }
    if (!reserveResult?.ok) {
      return NextResponse.json({ error: "Seat limit reached (" + cap + " seats on your current plan size). Upgrade your tier to invite more teammates." }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email: emailNorm,
      options: {
        data: { tenant_id: tenantId, role, position: position ?? null, invited: true },
        redirectTo: baseUrl + "/login",
      },
    });

    if (linkErr || !linkData) {
      await admin.from("team_invites").delete().eq("tenant_id", tenantId).eq("email_normalized", emailNorm).eq("status", "pending");
      return NextResponse.json({ error: linkErr?.message ?? "Failed to generate invite link." }, { status: 500 });
    }

    const inviteLink = linkData.properties?.action_link ?? "";

    await admin.from("team_invites").update({ invite_link: inviteLink }).eq("tenant_id", tenantId).eq("email_normalized", emailNorm);

    const html = '<div style="background:#f4f4f5;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;"><div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;"><div style="padding:32px 32px 20px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#10b981;">PivotOps</div><div style="font-size:10px;letter-spacing:1.5px;color:#a1a1aa;text-transform:uppercase;margin-top:4px;">Autonomous Workforce OS</div></div><div style="border-top:1px solid #e4e4e7;"></div><div style="padding:32px;color:#3f3f46;font-size:14px;line-height:1.6;"><h2 style="color:#18181b;font-size:20px;margin:0 0 12px;">You have been invited</h2><p style="margin:0 0 24px;">You have been invited to join a team on PivotOps as <strong>' + role + '</strong>. Accept the invitation to set up your account.</p><div style="text-align:center;margin:0 0 8px;"><a href="' + inviteLink + '" style="background:#10b981;color:#ffffff;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;display:inline-block;">Accept Invitation</a></div></div><div style="border-top:1px solid #e4e4e7;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:11px;color:#a1a1aa;">If you were not expecting this invitation, you can safely ignore this email.</p></div></div></div>';

    const emailResult = await sendEmail({ to: emailNorm, subject: "You've been invited to join PivotOps", html });

    await logAudit({ action: "TEAM_INVITE_SENT", actorId: user.id, actorName: user.email ?? user.id, entityType: "team_invite", entityId: emailNorm, metadata: { tenantId, role, emailSent: emailResult.ok } });

    return NextResponse.json({ success: true, inviteLink, emailSent: emailResult.ok });
  } catch (err) {
    console.error("Team invite error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send invite." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ route: "/api/team/invites", status: "ok" });
}