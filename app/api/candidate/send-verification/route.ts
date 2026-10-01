import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, EMAIL_SENDERS } from "@/lib/email";
import { baseLayout, h1, p, btn } from "@/lib/email/layout";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { authUserId, candidateId, tenantId, email, fullName } = await req.json();

    if (!authUserId || !tenantId || !email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const admin = getAdmin();

    // Invalidate any prior unused tokens for this user
    await admin
      .from("candidate_verifications")
      .update({ used: true })
      .eq("auth_user_id", authUserId)
      .eq("used", false);

    // Create fresh token
    const { data: verif, error: insErr } = await admin
      .from("candidate_verifications")
      .insert({
        auth_user_id: authUserId,
        candidate_id: candidateId || null,
        tenant_id:    tenantId,
        email:        email.trim().toLowerCase(),
      })
      .select("token")
      .single();

    if (insErr || !verif) {
      console.error("[send-verification] token insert failed", insErr);
      return NextResponse.json({ error: "Failed to create verification." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";
    const verifyUrl = `${baseUrl}/candidate/verify?token=${verif.token}`;

    const html = baseLayout({
      title:   "Verify your email — PivotOps",
      preview: "Confirm your email to access your candidate portal.",
      accentColor: "#6366f1",
      content: `
        ${h1("Verify your email")}
        ${p(`Hi ${fullName || "there"}, thanks for registering. Please confirm your email address to activate your candidate portal and upload your credentials.`)}
        ${btn("Verify Email & Access Portal", verifyUrl)}
        ${p("This link expires in 24 hours. If you did not request this, you can safely ignore this email.")}
      `,
    });

    const result = await sendEmail({
      to:      email.trim().toLowerCase(),
      subject: "Verify your email to access your PivotOps portal",
      html,
      from:    EMAIL_SENDERS.notifications,
      replyTo: "support@pivotops.app",
    });

    if (!result.ok) {
      console.error("[send-verification] email send failed", result.error);
      return NextResponse.json({ error: "Failed to send verification email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[send-verification]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}