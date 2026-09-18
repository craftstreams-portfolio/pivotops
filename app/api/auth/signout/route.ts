// CSRF protection — only allow signout from same origin
function validateOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  const allowed = [
    process.env.NEXT_PUBLIC_APP_URL ?? "",
    "http://localhost:3000",
    "https://www.pivotops.app",
  ];
  return allowed.some(a => a && origin.startsWith(a));
}
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!validateOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return POST_IMPL(req);
}
async function POST_IMPL(request: Request) {
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

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}