"use server";

import { revalidatePath } from "next/cache";
import { requirePageRole } from "@/lib/auth/redirects";
import {
  approveApplication,
  rejectApplication,
  setAmbassadorNotes,
} from "@/services/ambassadors";

const PATH = "/dashboard/admin/ambassadors";

export async function approveAction(formData: FormData): Promise<void> {
  await requirePageRole("owner");
  const id = String(formData.get("id") ?? "");
  if (id) await approveApplication(id);
  revalidatePath(PATH);
}

export async function rejectAction(formData: FormData): Promise<void> {
  await requirePageRole("owner");
  const id = String(formData.get("id") ?? "");
  if (id) await rejectApplication(id);
  revalidatePath(PATH);
}

export async function notesAction(formData: FormData): Promise<void> {
  await requirePageRole("owner");
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (id) await setAmbassadorNotes(id, notes);
  revalidatePath(PATH);
}
