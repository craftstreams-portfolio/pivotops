import { getAdmin } from "@/lib/supabase-admin";
import { signPostRequest } from "./signature";
import { SHOPLINE_APP_KEY, tokenCreateUrl, tokenRefreshUrl, storeBaseUrl } from "./config";

// SHOPLINE tokens are valid 10h. We refresh when < 1h remains.
const REFRESH_BEFORE_MS = 60 * 60 * 1000;

interface TokenResponse {
  accessToken: string;
  expireTime?: string | number; // ms epoch or ISO, per SHOPLINE
  scope?: string;
}

async function postSigned(url: string, bodyObj: Record<string, any>): Promise<any> {
  const body = JSON.stringify(bodyObj);
  const headers = signPostRequest(SHOPLINE_APP_KEY, body);
  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`SHOPLINE ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

function toExpiry(expireTime: string | number | undefined): string | null {
  if (expireTime == null) return null;
  const n = typeof expireTime === "string" ? Date.parse(expireTime) || Number(expireTime) : expireTime;
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

// Exchange an OAuth code for an access token (called from the callback route).
export async function createToken(handle: string, code: string): Promise<TokenResponse> {
  const data = await postSigned(tokenCreateUrl(handle), { code });
  console.log("[shopline] token/create raw response:", JSON.stringify(data));
  // SHOPLINE returns token fields possibly nested; normalize common shapes.
  const t = data?.data ?? data;
  return {
    accessToken: t.accessToken ?? t.access_token,
    expireTime: t.expireTime ?? t.expire_time ?? t.expiresTime,
    scope: t.scope,
  };
}

async function refreshToken(handle: string, oldToken: string): Promise<TokenResponse> {
  const data = await postSigned(tokenRefreshUrl(handle), { accessToken: oldToken });
  const t = data?.data ?? data;
  return {
    accessToken: t.accessToken ?? t.access_token,
    expireTime: t.expireTime ?? t.expire_time ?? t.expiresTime,
    scope: t.scope,
  };
}

// Returns a valid access token for a tenant+handle, refreshing lazily if near expiry.
export async function getValidToken(tenantId: string, handle: string): Promise<string | null> {
  const admin = getAdmin();
  const { data: conn, error } = await admin
    .from("shopline_connections")
    .select("access_token, expire_time, status")
    .eq("tenant_id", tenantId)
    .eq("handle", handle)
    .maybeSingle();

  if (error || !conn || conn.status !== "active") return null;

  const expMs = conn.expire_time ? Date.parse(conn.expire_time) : 0;
  const needsRefresh = expMs && expMs - Date.now() < REFRESH_BEFORE_MS;

  if (!needsRefresh) return conn.access_token;

  try {
    const refreshed = await refreshToken(handle, conn.access_token);
    await admin
      .from("shopline_connections")
      .update({
        access_token: refreshed.accessToken,
        expire_time: toExpiry(refreshed.expireTime),
        scope: refreshed.scope ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("handle", handle);
    return refreshed.accessToken;
  } catch (e) {
    console.error("[shopline] token refresh failed:", e);
    // Fall back to existing token (may still work briefly); route can handle 401.
    return conn.access_token;
  }
}

export { toExpiry };