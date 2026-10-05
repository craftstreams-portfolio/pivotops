import { createClient } from "@supabase/supabase-js";

/**
 * lib/shopify/pricing.ts
 *
 * Shopify App Pricing hosts the plan selection page - the app never creates
 * charges itself. Merchants who installed through Shopify are sent there
 * instead of the Dodo checkout, which is a hard App Store requirement:
 * off-platform billing is not permitted for App Store distribution.
 */

/** The app handle as it appears in the plan selection URL. */
const APP_HANDLE = "pivotops";

/** Builds the hosted plan selection URL for a shop domain. */
export function planSelectionUrl(shopDomain: string): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${handle}/charges/${APP_HANDLE}/pricing_plans`;
}

/** The Shopify store linked to a tenant, or null if billed elsewhere. */
export async function shopifyShopForTenant(tenantId: string): Promise<string | null> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await admin
    .from("shopify_installs")
    .select("shop")
    .eq("tenant_id", tenantId)
    .is("uninstalled_at", null)
    .maybeSingle();
  return data?.shop ?? null;
}