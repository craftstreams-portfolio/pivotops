import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Explicitly enabled so the client picks up the session token from the
      // URL hash on every browser, including Edge whose stricter URL handling
      // meant the fragment was never consumed and login hung at "Please wait".
      detectSessionInUrl: true,
      persistSession:     true,
      autoRefreshToken:   true,
    },
  }
);