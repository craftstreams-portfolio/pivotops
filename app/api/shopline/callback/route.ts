import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { verifyGetSignature, timestampValid } from "@/lib/shopline/signature";
import { verifyState } from "@/lib/shopline/state";
import { createToken, toExpiry } from "@/lib/shopline/token";
import { shoplineConfigured } from "@/lib/shopline/config";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pivotops.app";

// Shared OAuth callback for both entry points.
// GET ?appkey&code&handle&timestamp&sign&state
export async function GET(req: NextRequest) {
  if (!shoplineConfigured()) {
    return NextResponse.json({ error: "SHOPLINE not configured." }, { status: 503 });
  }

  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => { params[k] = v; });

  const { code, handle: rawHandle, state, timestamp } = params;
  const handle = String(rawHandle ?? "").trim().toLowerCase();

  if (!code || !handle) {
    return NextResponse.json({ error: "Missing code or handle." }, { status: 400 });
  }
  if (timestamp && !timestampValid(timestamp)) {
    return NextResponse.json({ error: "Stale callback." }, { status: 401 });
  }
  if (!verifyGetSignature(params)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Validate state (carries tenantId for Entry A, null for Entry B).
  const st = state ? verifyState(state) : null;
  if (!st || st.handle !== handle) {
    return NextResponse.json({ error: "Invalid or expired state." }, { status: 401 });
  }

  // Exchange the code for an access token.
  let tokenRes;
  try {
    tokenRes = await createToken(handle, code);
  } catch (e) {
    console.error("[shopline/callback] token create failed:", e);
    return NextResponse.json({ error: "Token exchange failed." }, { status: 502 });
  }
  if (!tokenRes?.accessToken) {
    return NextResponse.json({ error: "No access token returned." }, { status: 502 });
  }

  const admin = getAdmin();
  const nowIso = new Date().toISOString();
  const expiry = toExpiry(tokenRes.expireTime);

  if (st.tenantId) {
    // Entry A: link directly to the known tenant (upsert on tenant_id+handle).
    await admin.from("shopline_connections").upsert({
      tenant_id: st.tenantId,
      handle,
      access_token: tokenRes.accessToken,
      scope: tokenRes.scope ?? null,
      expire_time: expiry,
      status: "active",
      installed_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: "tenant_id,handle" });

    return NextResponse.redirect(`${APP_URL}/dashboard/settings/integrations?shopline=connected&store=${encodeURIComponent(handle)}`);
  }

  // Entry B: no tenant yet. Store a pending row with a one-time claim token,
  // then send the merchant to sign up. create-tenant will consume the token.
  const claimToken = crypto.randomBytes(24).toString("hex");
  const claimExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await admin.from("shopline_connections").upsert({
    tenant_id: null,
    handle,
    access_token: tokenRes.accessToken,
    scope: tokenRes.scope ?? null,
    expire_time: expiry,
    status: "pending",
    installed_at: nowIso,
    updated_at: nowIso,
    claim_token: claimToken,
    claim_expires_at: claimExpires,
  }, { onConflict: "handle" });

  return NextResponse.redirect(`${APP_URL}/onboarding?shopline_claim=${claimToken}`);
}