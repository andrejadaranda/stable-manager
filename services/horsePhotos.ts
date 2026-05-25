// Horse photo gallery service.
// Beyond the single `horses.photo_url` hero, this manages multi-photo
// gallery per horse — favorite ride moments, conformation shots, etc.

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

// Type re-exported from .pure for client components per server-pure-split-pattern.
export { type HorsePhoto } from "./horsePhotos.pure";
import type { HorsePhoto } from "./horsePhotos.pure";

export async function listHorsePhotos(horseId: string): Promise<HorsePhoto[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_photos")
    .select("id, url, caption, sort_order, created_at")
    .eq("horse_id", horseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HorsePhoto[];
}

/** Upload a photo. Owner/employee/horse-owner allowed (RLS enforces). */
export async function uploadHorsePhoto(input: {
  horseId: string;
  file:    File | Blob;
  fileName: string;
  contentType: string;
  caption?: string | null;
}): Promise<{ id: string; url: string }> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee", "client");

  if (input.file instanceof Blob && input.file.size > 8_000_000) {
    throw new Error("FILE_TOO_LARGE");
  }
  if (!/^image\/(png|jpe?g|webp|heic)$/i.test(input.contentType)) {
    throw new Error("UNSUPPORTED_FORMAT");
  }

  const ext = (input.fileName.split(".").pop() ?? "jpg").toLowerCase();
  const safeId = crypto.randomUUID();
  const path = `horse-gallery/${ctx.stableId}/${input.horseId}/${safeId}.${ext}`;

  // Admin client bypasses RLS for storage; the database insert is RLS-guarded.
  const admin = createSupabaseAdminClient();
  const arrayBuf = input.file instanceof Blob ? await input.file.arrayBuffer() : input.file;
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, arrayBuf as ArrayBuffer, {
      contentType: input.contentType,
      upsert: false,
    });
  if (upErr) throw new Error(`UPLOAD_FAILED:${upErr.message}`);

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);

  // DB insert via user client so RLS narrows to this stable + role check.
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_photos")
    .insert({
      stable_id:   ctx.stableId,
      horse_id:    input.horseId,
      url:         pub.publicUrl,
      caption:     input.caption ?? null,
      uploaded_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) {
    // Best-effort cleanup of the orphan storage object.
    await admin.storage.from("avatars").remove([path]).catch(() => {});
    throw error;
  }

  return { id: data.id, url: pub.publicUrl };
}

export async function deleteHorsePhoto(id: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee", "client");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horse_photos")
    .delete()
    .eq("id", id)
    .eq("stable_id", ctx.stableId);
  if (error) throw error;
}

export async function updateHorsePhotoCaption(id: string, caption: string | null): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee", "client");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horse_photos")
    .update({ caption })
    .eq("id", id)
    .eq("stable_id", ctx.stableId);
  if (error) throw error;
}
