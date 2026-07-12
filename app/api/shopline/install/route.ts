import { NextRequest, NextResponse } from "next/server";
import { verifyGetSignature, timestampValid } from "@/lib/shopline/signature";
import { createState } from "@/lib/shopline/state";
import { authorizeUrl, shoplineConfigured } from "@/lib/shopline/config";

export const dynamic = "force-dynamic";

// Entry B: SHOPLINE sends the merchant here when they install/open the app.
// GET ?appkey&handle&timestamp&sign  -> verify -> redirect to authorize (no tenant yet).
export async function GET(req: NextRequest) {
  if (!shoplineConfigured()) {
    return NextResponse.json({ error: "SHOPLINE not configured." }, { status: 503 });
  }

  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => { params[k] = v; });

  const handle = String(params.handle ?? "").trim().toLowerCase();
  if (!handle) return NextResponse.json({ error: "Missing handle." }, { status: 400 });

  if (params.timestamp) {
    const skew = Math.abs(Date.now() - Number(params.timestamp));
    if (!timestampValid(params.timestamp, 30 * 60 * 1000)) {
      console.error("[shopline/install] timestamp skew too large:", skew, "ms; ts:", params.timestamp);
      return NextResponse.json({ error: "Stale request.", _debug: { skewMs: skew, ts: params.timestamp, now: Date.now() } }, { status: 401 });
    }
  }
  if (!verifyGetSignature(params)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const state = createState(null, handle); // Entry B: no tenant yet
  return NextResponse.redirect(authorizeUrl(handle, state));
}