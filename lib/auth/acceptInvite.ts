import type { SupabaseClient } from "@supabase/supabase-js";

export type AcceptInviteResult =
  | { ok: true; tenantId: string; role: string }
  | { ok: false; reason: string };

/**
 * Flips the caller's pending team_invite to accepted and provisions their
 * profile, server-side via SECURITY DEFINER.
 *
 * Do NOT go back to updating team_invites from the browser client:
 *   1. A newly signed-up user has no tenant yet, so
 *      tenant_isolation_team_invites (tenant_id = get_caller_tenant_id())
 *      evaluates NULL and the UPDATE matches zero rows without erroring.
 *   2. The old query matched on email_normalized, which is not populated on
 *      every invite row.
 * Both failures were silent. The RPC keys off the JWT email instead.
 */
export async function acceptTeamInvite(
  supabase: SupabaseClient
): Promise<AcceptInviteResult> {
  const { data, error } = await supabase.rpc("accept_team_invite");

  if (error) {
    console.error("[acceptTeamInvite] rpc error:", error.message);
    return { ok: false, reason: error.message };
  }
  if (!data || data.ok !== true) {
    return { ok: false, reason: data?.reason ?? "unknown" };
  }
  return { ok: true, tenantId: data.tenant_id, role: data.role };
}
