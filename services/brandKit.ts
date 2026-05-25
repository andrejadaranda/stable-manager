// Brand kit service — per-stable logo + brand color.
//
// Reads are open to all roles in the stable (sidebar header, share
// cards rendered for clients). Writes are owner-only.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type BrandKit = {
  brand_color: string;          // hex, defaults to paddock-green
  logo_url:    string | null;
  stable_name: string;
};

const DEFAULT_BRAND_COLOR = "#1E3A2A";

export async function getBrandKit(stableId?: string): Promise<BrandKit> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();
  const id = stableId ?? ctx.stableId;
  const { data } = await supabase
    .from("stables")
    .select("name, brand_color, logo_url")
    .eq("id", id)
    .maybeSingle();
  return {
    brand_color: data?.brand_color ?? DEFAULT_BRAND_COLOR,
    logo_url:    data?.logo_url    ?? null,
    stable_name: data?.name        ?? "Longrein",
  };
}

/** Owner-only — saves brand color. */
export async function updateBrandColor(hex: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("INVALID_COLOR");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stables")
    .update({ brand_color: hex })
    .eq("id", ctx.stableId);
  if (error) throw error;
}

/** Owner-only — saves logo URL (uploaded separately to storage). */
export async function updateLogoUrl(url: string | null): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stables")
    .update({ logo_url: url })
    .eq("id", ctx.stableId);
  if (error) throw error;
}
