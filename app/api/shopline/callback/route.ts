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
  // Signature is the real security guarantee; verify it strictly.
  if (!verifyGetSignature(params)) {
    console.error("[shopline/callback] invalid signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  // Timestamp is replay-protection only. Log skew but don't hard-reject on
  // normal OAuth latency (user approval + round-trip can exceed a tight window).
  if (timestamp) {
    const skew = Math.abs(Date.now() - Number(timestamp));
    if (skew > 30 * 60 * 1000) {
      console.error("[shopline/callback] timestamp skew too large:", skew, "ms");
      return NextResponse.json({ error: "Stale callback." }, { status: 401 });
    }
  }

  // State carries tenantId for Entry A (app-initiated). SHOPLINE-initiated installs
  // (Test App / App Store) do NOT round-trip a state param — the GET signature above
  // is the authenticity guarantee there. So: enforce state strictly when present,
  // and treat its absence as Entry B (no tenant yet).
  const st = state ? verifyState(state) : null;
  if (state && (!st || st.handle !== handle)) {
    console.error("[shopline/callback] state present but invalid/mismatched");
    return NextResponse.json({ error: "Invalid or expired state." }, { status: 401 });
  }
  const stateTenantId: string | null = st?.tenantId ?? null;

  // Exchange the code for an access token.
  let tokenRes;
  try {
    tokenRes = await createToken(handle, code);
  } catch (e: any) {
    console.error("[shopline/callback] token create failed:", e?.message ?? e);
    return NextResponse.json({ error: "Token exchange failed.", _debug: String(e?.message ?? e) }, { status: 502 });
  }
  if (!tokenRes?.accessToken) {
    console.error("[shopline/callback] no accessToken in response:", JSON.stringify(tokenRes));
    return NextResponse.json({ error: "No access token returned.", _debug: tokenRes }, { status: 502 });
  }

  const admin = getAdmin();
  const nowIso = new Date().toISOString();
  const expiry = toExpiry(tokenRes.expireTime);

  if (stateTenantId) {
    // Entry A: link directly to the known tenant (upsert on tenant_id+handle).
    await admin.from("shopline_connections").upsert({
      tenant_id: stateTenantId,
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

  // NOTE: the only unique index on `handle` alone is PARTIAL
  // (idx_shopline_pending_handle ... WHERE tenant_id IS NULL), which Postgres
  // cannot infer from a bare ON CONFLICT (handle) -> 42P10. So we do an explicit
  // lookup + update/insert against the pending row instead of an upsert.
  const conn = {
    tenant_id: null as string | null,
    handle,
    access_token: tokenRes.accessToken,
    scope: tokenRes.scope ?? null,
    expire_time: expiry,
    status: "pending",
    installed_at: nowIso,
    updated_at: nowIso,
    claim_token: claimToken,
    claim_expires_at: claimExpires,
  };

  const { data: existing } = await admin
    .from("shopline_connections")
    .select("id")
    .eq("handle", handle)
    .is("tenant_id", null)
    .maybeSingle();

  const { error: upsertErr } = existing
    ? await admin.from("shopline_connections").update(conn).eq("id", existing.id)
    : await admin.from("shopline_connections").insert(conn);

  if (upsertErr) {
    console.error("[shopline/callback] Entry-B upsert failed:", upsertErr.code, upsertErr.message, upsertErr.details);
    return NextResponse.json({ error: "Could not save connection.", _debug: upsertErr }, { status: 500 });
  }

  return NextResponse.redirect(`${APP_URL}/onboarding?shopline_claim=${claimToken}`);
}