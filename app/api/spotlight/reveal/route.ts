import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase-admin";

const TEAMS_MEDIA_CHANNEL = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function extractMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as Record<string, any>;
  return e.message ?? e.details ?? e.hint ?? JSON.stringify(e);
}

// ─────────────────────────────────────────
// POST /api/spotlight/reveal
// Called by Vercel cron: "0 5 1 * *"  (1st of month, 05:00 UTC = 12:00 AM EST)
//
// vercel.json:
// { "crons": [{ "path": "/api/spotlight/reveal", "schedule": "0 5 1 * *" }] }
// ─────────────────────────────────────────
export async function POST(req: Request) {
  const authHeader = (req as any).headers?.get?.("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = new Date();

    // Find all spotlights ready to reveal (reveal_at <= now, approved, not yet visible)
    const { data: due, error } = await getAdmin()
      .from("spotlights")
      .select("*")
      .eq("approval_status", "approved")
      .eq("is_spotlight_of_month", true)
      .lte("reveal_at", now.toISOString())
      .is("metadata->revealed", null);

    if (error) throw new Error(extractMessage(error));
    if (!due || due.length === 0) {
      return NextResponse.json({ message: "No spotlights due for reveal", count: 0 });
    }

    let revealed = 0;

    for (const spotlight of due) {
      const tenantId   = spotlight.tenant_id ?? "default";
      const monthLabel = new Date(spotlight.reveal_at ?? now).toLocaleString("en-US", {
        month: "long", year: "numeric",
      });

      // Mark as revealed in metadata
      await getAdmin().from("spotlights").update({
        metadata:   { ...(spotlight.metadata ?? {}), revealed: true, revealed_at: now.toISOString() },
        updated_at: now.toISOString(),
      }).eq("id", spotlight.id);

      // Get avatar from profiles
      const { data: profile } = await getAdmin()
        .from("profiles")
        .select("avatar_url")
        .eq("id", spotlight.user_id ?? "")
        .single();

      const avatarUrl = spotlight.image_url ?? profile?.avatar_url ?? null;

      // Update spotlight_of_month with avatar
      await getAdmin().from("spotlight_of_month").update({
        avatar_url: avatarUrl,
      }).eq("spotlight_id", spotlight.id);

      // Post reveal announcement to teams-media
      const content = [
        `🎉 **Spotlight of the Month is now LIVE — ${monthLabel}!**`,
        ``,
        `Congratulations to **${spotlight.created_by}** 🏆`,
        ``,
        spotlight.category ? `📌 ${spotlight.category}` : "",
        ``,
        spotlight.reason,
        ``,
        spotlight.analysis ? `💬 "${spotlight.analysis}"` : "",
        ``,
        `Their avatar is now displayed on every employee's dashboard for ${monthLabel}.`,
      ].filter(Boolean).join("\n");

      await getAdmin().from("messages").insert({
        channel_id:  TEAMS_MEDIA_CHANNEL,
        content,
        user_id:     "00000000-0000-0000-0000-000000000000",
        user_name:   "PivotOps · Spotlight",
        tenant_id:   tenantId,
        type:        "system",
        retracted:   false,
        reactions:   {},
        meta: {
          type:          "spotlight_revealed",
          spotlight_id:  spotlight.id,
          employee_name: spotlight.created_by,
          avatar_url:    avatarUrl,
          month:         spotlight.spotlight_month,
        },
        created_at: now.toISOString(),
      });

      // Xavier notification to all users
      await getAdmin().from("xavier_notifications").insert({
        tenant_id:    tenantId,
        candidate_id: null,
        stage:        "onboarding_complete",
        message:      `🌟 Spotlight of the Month: ${spotlight.created_by} is now featured on all dashboards for ${monthLabel}!`,
        type:         "success",
        read:         false,
        created_at:   now.toISOString(),
      });

      revealed++;
    }

    return NextResponse.json({
      success: true,
      revealed,
      message: `${revealed} spotlight(s) revealed for ${now.toLocaleString("en-US", { month: "long", year: "numeric" })}`,
    });

  } catch (err) {
    const msg = extractMessage(err);
    console.error("Spotlight reveal failed:", msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Spotlight Reveal Engine",
    info:    "POST to trigger reveal. Runs automatically on 1st of each month at 12:00 AM EST.",
    cron:    "0 5 1 * *",
  });
}