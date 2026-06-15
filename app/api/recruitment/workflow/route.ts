import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    // 1. Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get request body
    const body = await req.json();
    const { candidateId } = body;

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required" },
        { status: 400 }
      );
    }

    // 3. Log audit event
    await logAudit({
      action: "schedule_interview",
      actorName: user.user_metadata?.full_name ?? "Recruiter",
      actorId: user.id,
      entityType: "candidate",
      entityId: candidateId,
    });

    // 4. Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Workflow API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}