"use server";

import { revalidatePath } from "next/cache";
import { updateBrandColor, updateLogoUrl } from "@/services/brandKit";
import { getSession, requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type BrandState = { error: string | null; success: boolean };

export async function saveBrandColorAction(
  _prev: BrandState,
  formData: FormData,
): Promise<BrandState> {
  const hex = String(formData.get("brand_color") ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return { error: "Pick a valid hex color (#RRGGBB).", success: false };
  }
  try {
    await updateBrandColor(hex);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save.", success: false };
  }
  revalidatePath("/dashboard/settings/brand");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

export async function uploadLogoAction(formData: FormData): Promise<{
  error: string | null;
  url:   string | null;
}> {
  const ctx = await getSession();
  requireRole(ctx, "owner");

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected.", url: null };
  }
  if (file.size > 2_000_000) {
    return { error: "Logo too large (max 2 MB).", url: null };
  }
  if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(file.type)) {
    return { error: "Logo must be PNG, JPG, WebP, or SVG.", url: null };
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `stable-logo/${ctx.stableId}.${ext}`;

  const supabase = createSupabaseAdminClient();
  // Remove any prior logo objects for this stable to avoid CDN cache stale.
  await supabase.storage.from("avatars").remove([
    `stable-logo/${ctx.stableId}.png`,
    `stable-logo/${ctx.stableId}.jpg`,
    `stable-logo/${ctx.stableId}.jpeg`,
    `stable-logo/${ctx.stableId}.webp`,
    `stable-logo/${ctx.stableId}.svg`,
  ]).catch(() => {});

  const arrayBuf = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuf, { contentType: file.type, upsert: true });
  if (upErr) {
    return { error: `Upload failed: ${upErr.message}`, url: null };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  await updateLogoUrl(pub.publicUrl);

  revalidatePath("/dashboard/settings/brand");
  revalidatePath("/dashboard");
  return { error: null, url: pub.publicUrl };
}

export async function removeLogoAction(): Promise<{ error: string | null }> {
  try {
    await updateLogoUrl(null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove." };
  }
  revalidatePath("/dashboard/settings/brand");
  return { error: null };
}
