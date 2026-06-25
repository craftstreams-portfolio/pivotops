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
    const { authUserId, email, fullName } = await req.json();
    if (!authUserId || !email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const admin = getAdmin();

    await admin
      .from("owner_verifications")
      .update({ used: true })
      .eq("auth_user_id", authUserId)
      .eq("used", false);

    const { data: verif, error: insErr } = await admin
      .from("owner_verifications")
      .insert({
        auth_user_id: authUserId,
        email:        email.trim().toLowerCase(),
        full_name:    fullName || null,
      })
      .select("token")
      .single();

    if (insErr || !verif) {
      console.error("[owner send-verification] insert failed", insErr);
      return NextResponse.json({ error: "Failed to create verification." }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";
    const verifyUrl = `${baseUrl}/onboarding/verify?token=${verif.token}`;

    const html = baseLayout({
      title:   "Verify your email — PivotOps",
      preview: "Confirm your email to set up your PivotOps workspace.",
      accentColor: "#6366f1",
      content: `
        ${h1("Welcome to PivotOps")}
        ${p(`Hi ${fullName || "there"}, thanks for signing up. Confirm your email to activate your account and start setting up your workspace.`)}
        ${btn("Verify Email & Start Setup", verifyUrl)}
        ${p("This link expires in 24 hours. If you did not sign up, you can ignore this email.")}
      `,
    });

    const result = await sendEmail({
      to:      email.trim().toLowerCase(),
      subject: "Verify your email to set up your PivotOps workspace",
      html,
      from:    EMAIL_SENDERS.notifications,
      replyTo: "support@pivotops.app",
    });

    if (!result.ok) {
      console.error("[owner send-verification] email failed", result.error);
      return NextResponse.json({ error: "Failed to send verification email." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[owner send-verification]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}