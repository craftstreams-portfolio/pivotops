import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // A freshly confirmed signup has no tenant yet - sending them to
    // /dashboard means landing on a workspace that does not exist, which
    // hangs or bounces. Route by whether onboarding is actually done.
    if (!error && data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, onboarding_complete")
        .eq("id", data.user.id)
        .maybeSingle();

      const ready = !!profile?.tenant_id && profile.onboarding_complete === true;

      // Preserve the SHOPLINE claim token across the redirect - without this
      // a merchant installing from SHOPLINE would lose their store claim
      // silently when they confirm their email.
      const claim = requestUrl.searchParams.get("shopline_claim");
      const dest = ready
        ? "/dashboard"
        : "/onboarding" + (claim ? `?shopline_claim=${encodeURIComponent(claim)}` : "");
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}