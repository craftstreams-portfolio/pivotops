import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Service-role creation of the candidate_accounts row + candidates link.
// The registering candidate has just signed up but has no active session
// (email confirmation pending), so a client insert can't satisfy the
// ca_self_insert RLS check (auth.uid() = auth_user_id). We do it server-side.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { authUserId, candidateId, tenantId, fullName, email, ssn4, city, state, country } = body;

    if (!authUserId || !tenantId || !email || !fullName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const admin = getAdmin();
    const emailNorm = String(email).trim().toLowerCase();

    // Upsert the candidate account by auth_user_id
    const { data: existing } = await admin
      .from("candidate_accounts")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const fields = {
      candidate_id: candidateId || null,
      tenant_id:    tenantId,
      auth_user_id: authUserId,
      full_name:    String(fullName).trim(),
      email:        emailNorm,
      ssn_last4:    ssn4  ? String(ssn4).trim()  : null,
      city:         city  ? String(city).trim()  : null,
      state:        state ? String(state).trim() : null,
      country:      country ? String(country).trim() : "United States",
      role:         "candidate",
    };

    if (existing) {
      const { error: updErr } = await admin
        .from("candidate_accounts")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("auth_user_id", authUserId);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await admin.from("candidate_accounts").insert(fields);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Link + mark the candidate row registered
    if (candidateId) {
      await admin
        .from("candidates")
        .update({
          name:          String(fullName).trim(),
          auth_user_id:  authUserId,
          status:        "registered",
          registered_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .eq("tenant_id", tenantId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[candidate/register]", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}