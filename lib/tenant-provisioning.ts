import { supabase } from "@/lib/supabase";

/* ────────────────────────────────────────────────────────────────────────
   EMAIL NORMALIZATION (Critical Fix #2)
   Use this everywhere an email is compared or stored — signup, login,
   invites — so John@Co.com / john@co.com never become two accounts.
──────────────────────────────────────────────────────────────────────── */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ────────────────────────────────────────────────────────────────────────
   SLUG GENERATION (Critical Fix #5)
   pivotops.ai/apply/acme-staffing — and acme-staffing-2 if that's taken.
──────────────────────────────────────────────────────────────────────── */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function generateUniqueSlug(orgName: string): Promise<string> {
  const base = slugify(orgName) || "agency";
  let candidate = base;
  let attempt = 0;

  while (attempt < 25) {
    const { data, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return candidate; // no collision — this slug is free

    attempt += 1;
    candidate = `${base}-${attempt + 1}`;
  }

  // Statistically near-impossible fallback if 25 sequential suffixes are all taken
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ────────────────────────────────────────────────────────────────────────
   SAFE TENANT PROVISIONING (Critical Fix #4)

   Call this from onboarding's completion step INSTEAD OF a raw
   `supabase.from('tenants').insert(...)`. It guards against two real bugs:

   1. A user who already has a tenant getting a SECOND one created —
      e.g. they re-run onboarding from a different browser, or refresh
      mid-flow and resubmit.
   2. Two organizations colliding on the same apply-portal slug.

   Usage in your onboarding submit handler:

     const { tenantId, slug, alreadyExisted } = await provisionTenantSafely({
       userId: user.id,
       orgName: formData.orgName,
     });

     // use `tenantId` for every subsequent insert (settings, score_thresholds,
     // channels, etc.) instead of a freshly-generated id. Show the buyer
     // their apply link as `pivotops.ai/apply/${slug}` on the completion screen.
──────────────────────────────────────────────────────────────────────── */
export async function provisionTenantSafely(params: {
  userId: string;
  orgName: string;
  extraTenantFields?: Record<string, any>;
}): Promise<{ tenantId: string; slug: string; alreadyExisted: boolean }> {
  // 1. Does this user already have a tenant?
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", params.userId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);

  if (profile?.tenant_id) {
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (existingTenant) {
      // Self-heal: if it somehow has no slug yet, generate one now
      if (!existingTenant.slug) {
        const slug = await generateUniqueSlug(params.orgName);
        await supabase.from("tenants").update({ slug }).eq("id", existingTenant.id);
        return { tenantId: existingTenant.id, slug, alreadyExisted: true };
      }
      return { tenantId: existingTenant.id, slug: existingTenant.slug, alreadyExisted: true };
    }
    // profile.tenant_id points at a row that no longer exists — fall through
    // and provision a fresh tenant rather than failing the user's signup.
  }

  // 2. Generate a collision-free slug
  const slug = await generateUniqueSlug(params.orgName);

  // 3. Create the tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({
      name: params.orgName,
      slug,
      ...(params.extraTenantFields ?? {}),
    })
    .select()
    .single();

  if (tenantErr) throw new Error(tenantErr.message);

  // 4. Link the profile to the new tenant
  const { error: linkErr } = await supabase
    .from("profiles")
    .update({ tenant_id: tenant.id })
    .eq("id", params.userId);

  if (linkErr) throw new Error(linkErr.message);

  return { tenantId: tenant.id, slug: tenant.slug, alreadyExisted: false };
}

/* ────────────────────────────────────────────────────────────────────────
   DUPLICATE-EMAIL CHECK FOR SIGNUP (Critical Fix #2, app-side guard
   in front of the DB unique index above — gives a clean "sign in instead"
   message rather than a raw constraint-violation error)
──────────────────────────────────────────────────────────────────────── */
export async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email_normalized", normalizeEmail(email))
    .maybeSingle();
  return !!data;
}