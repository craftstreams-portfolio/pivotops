import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { planSelectionUrl, shopifyShopForTenant } from "@/lib/shopify/pricing";

/**
 * app/api/billing/destination/route.ts
 *
 * Answers where a tenant should be sent to subscribe. Merchants who
 * installed through Shopify must be charged by Shopify - off-platform
 * billing is not permitted for App Store distribution - so they go to
 * Shopify's hosted plan selection page. Everyone else goes to Dodo.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user } } = await authClient.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles")
    .select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ provider: "dodo" });

  const shop = await shopifyShopForTenant(profile.tenant_id);
  if (shop) {
    return NextResponse.json({ provider: "shopify", url: planSelectionUrl(shop), shop });
  }
  return NextResponse.json({ provider: "dodo" });
}