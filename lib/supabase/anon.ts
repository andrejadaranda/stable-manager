// Anon Supabase client — for unauthenticated server actions / RPCs
// that are public by design (e.g. /signup/join — applicant has no
// session yet). Carries no session cookies; RLS treats every query
// as the Supabase `anon` role.
//
// Use this ONLY for endpoints that have explicit anon-friendly RLS
// policies or SECURITY DEFINER RPCs marked GRANT EXECUTE TO anon.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export function createSupabaseAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
