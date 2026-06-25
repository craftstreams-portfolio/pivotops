import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

    const admin = getAdmin();

    const { data: verif, error } = await admin
      .from("owner_verifications")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !verif) {
      return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
    }
    if (verif.used) {
      return NextResponse.json({ error: "This link has already been used.", alreadyUsed: true }, { status: 409 });
    }
    if (new Date(verif.expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 410 });
    }

    const { error: confirmErr } = await admin.auth.admin.updateUserById(
      verif.auth_user_id,
      { email_confirm: true }
    );
    if (confirmErr) {
      console.error("[owner verify-token] confirm failed", confirmErr);
      return NextResponse.json({ error: "Failed to verify. Please try again." }, { status: 500 });
    }

    await admin
      .from("owner_verifications")
      .update({ used: true })
      .eq("token", token);

    return NextResponse.json({ ok: true, email: verif.email });
  } catch (err) {
    console.error("[owner verify-token]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}