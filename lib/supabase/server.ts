// Supabase server client — used inside Server Components, Route Handlers,
// and Server Actions. Reads the user session from cookies; all queries run
// under that user's JWT, so RLS enforces tenant isolation automatically.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Server Components are not allowed to mutate cookies (Next.js limit).
        // Middleware refreshes the session on every request, so it's safe to
        // swallow the throw here. Server Actions / Route Handlers still write
        // normally because the cookie store IS mutable in those contexts.
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* called from a Server Component — ignore */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    },
  );
}

// Service-role client. NEVER import from client components.
// Used only for trusted server-side operations that must bypass RLS
// (e.g. inviting a new user via auth admin API).
import { createClient } from "@supabase/supabase-js";
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
