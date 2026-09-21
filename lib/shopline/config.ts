// Central SHOPLINE app configuration.
// Credentials come from env (set in Vercel): SHOPLINE_APP_KEY, SHOPLINE_APP_SECRET, SHOPLINE_REDIRECT_URI

export const SHOPLINE_APP_KEY = process.env.SHOPLINE_APP_KEY ?? "";
export const SHOPLINE_APP_SECRET = process.env.SHOPLINE_APP_SECRET ?? "";
export const SHOPLINE_REDIRECT_URI =
  process.env.SHOPLINE_REDIRECT_URI ?? "https://www.pivotops.app/api/shopline/callback";

// Scopes that work on all store tiers (NOT read_store_staff, which is Enterprise-only).
export const SHOPLINE_SCOPES = ["read_store_information", "read_orders", "read_location"];
export const SHOPLINE_SCOPE_STRING = SHOPLINE_SCOPES.join(",");

// A SHOPLINE store handle is its subdomain, e.g. "mystore" from mystore.myshopline.com
export function storeBaseUrl(handle: string): string {
  return `https://${handle}.myshopline.com`;
}

// OAuth authorize URL the merchant is redirected to (hash-route per SHOPLINE spec).
export function authorizeUrl(handle: string, state: string): string {
  const base = storeBaseUrl(handle);
  const params = new URLSearchParams({
    appKey: SHOPLINE_APP_KEY,
    responseType: "code",
    scope: SHOPLINE_SCOPE_STRING,
    redirectUri: SHOPLINE_REDIRECT_URI,
    state,
  });
  return `${base}/admin/oauth-web/#/oauth/authorize?${params.toString()}`;
}

// Token endpoints (POST, signed with body+timestamp).
export function tokenCreateUrl(handle: string): string {
  return `${storeBaseUrl(handle)}/admin/oauth/token/create`;
}
export function tokenRefreshUrl(handle: string): string {
  return `${storeBaseUrl(handle)}/admin/oauth/token/refresh`;
}

export function shoplineConfigured(): boolean {
  return Boolean(SHOPLINE_APP_KEY && SHOPLINE_APP_SECRET);
}