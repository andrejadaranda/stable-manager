// Public read-only data for /s/[slug] — what shows when an owner
// shares their stable's URL on Instagram or in a WhatsApp message.
//
// This deliberately uses the *anon* Supabase client and a SECURITY
// DEFINER RPC (or an RLS-public read policy) — the owner doesn't have
// to be signed in. Sensitive fields stay private:
//
//   * Stable: name, slug only.
//   * Horses: only those with a public_bio set (owner opts in per horse),
//     showing name, breed, photo_url, public_bio.
//   * Services: active services from the stable's price list.
//
// If RLS doesn't yet permit anon read, we fall back to empty arrays
// rather than throwing — the page degrades to a friendly "Coming soon"
// state instead of 500.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function anonClient() {
  // No cookie, no session — pure anonymous read. Bypasses our SSR
  // helper which always tries to attach the cookie.
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

export type PublicStable = {
  id:    string;
  slug:  string;
  name:  string;
};

export type PublicHorse = {
  id:         string;
  name:       string;
  breed:      string | null;
  photo_url:  string | null;
  public_bio: string | null;
};

export type PublicService = {
  id:                       string;
  name:                     string;
  description:              string | null;
  base_price:               number;
  default_duration_minutes: number;
};

export type PublicStableData = {
  stable:   PublicStable | null;
  horses:   PublicHorse[];
  services: PublicService[];
};

export async function getPublicStable(slug: string): Promise<PublicStableData> {
  if (!slug) return { stable: null, horses: [], services: [] };

  const sb = anonClient();
  // Stable lookup — anon RLS must allow id, slug, name. If it doesn't,
  // we get null and the page renders the "no listing" state gracefully.
  const stableRes = await sb
    .from("stables")
    .select("id, slug, name")
    .eq("slug", slug.toLowerCase())
    .single();

  if (stableRes.error || !stableRes.data) {
    return { stable: null, horses: [], services: [] };
  }
  const stable = stableRes.data as PublicStable;

  const [horsesRes, servicesRes] = await Promise.all([
    sb
      .from("horses")
      .select("id, name, breed, photo_url, public_bio")
      .eq("stable_id", stable.id)
      .eq("active", true)
      .not("public_bio", "is", null)
      .order("name"),
    sb
      .from("services")
      .select("id, name, description, base_price, default_duration_minutes, active")
      .eq("stable_id", stable.id)
      .eq("active", true)
      .order("name"),
  ]);

  return {
    stable,
    horses:   ((horsesRes.data ?? []) as PublicHorse[]),
    services: ((servicesRes.data ?? []) as PublicService[]),
  };
}
