"use server";

import { revalidatePath } from "next/cache";
import { uploadHorsePhoto, deleteHorsePhoto, updateHorsePhotoCaption } from "@/services/horsePhotos";

export async function uploadPhotoAction(
  horseId: string,
  formData: FormData,
): Promise<{ error: string | null; url: string | null }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "Pick a photo.", url: null };
  try {
    const { url } = await uploadHorsePhoto({
      horseId,
      file,
      fileName:    file.name,
      contentType: file.type,
      caption:     String(formData.get("caption") ?? "").trim() || null,
    });
    revalidatePath(`/dashboard/horses/${horseId}`);
    return { error: null, url };
  } catch (e) {
    const m = e instanceof Error ? e.message : "Upload failed.";
    if (m === "FILE_TOO_LARGE") return { error: "Max 8 MB per photo.", url: null };
    if (m === "UNSUPPORTED_FORMAT") return { error: "PNG, JPG, WebP, or HEIC only.", url: null };
    return { error: m, url: null };
  }
}

export async function deletePhotoAction(id: string, horseId: string): Promise<void> {
  await deleteHorsePhoto(id);
  revalidatePath(`/dashboard/horses/${horseId}`);
}

export async function captionPhotoAction(
  id: string,
  horseId: string,
  caption: string,
): Promise<void> {
  await updateHorsePhotoCaption(id, caption.trim() || null);
  revalidatePath(`/dashboard/horses/${horseId}`);
}
