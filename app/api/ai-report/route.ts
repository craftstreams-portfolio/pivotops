import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const VALID_REASONS = ["inaccurate", "offensive", "misleading", "other"];

// In-memory throttle. Good enough to stop casual abuse of a public endpoint;
// resets on cold start, which is acceptable for a low-volume report path.
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > LIMIT;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
    }

    const { surface, reason, note, content } = await req.json();

    if (!surface || typeof surface !== "string") {
      return NextResponse.json({ error: "Missing surface." }, { status: 400 });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason." }, { status: 400 });
    }

    const { error } = await getAdmin().from("ai_content_reports").insert({
      tenant_id:        null,          // public surface: no tenant
      user_id:          null,
      surface:          String(surface).slice(0, 64),
      ref_id:           null,
      content_snapshot: content ? String(content).slice(0, 4000) : null,
      reason,
      note:             note ? String(note).slice(0, 1000) : null,
    });

    if (error) {
      console.error("[ai-report] insert failed:", error.message);
      return NextResponse.json({ error: "Could not save the report." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ai-report]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}