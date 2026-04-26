"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient, type SkillLevel } from "@/services/clients";

export type CreateClientState = { error: string | null; success: boolean };

const initial: CreateClientState = { error: null, success: false };

const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "pro"];

export async function createClientAction(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email    = String(formData.get("email") ?? "").trim();
  const phone    = String(formData.get("phone") ?? "").trim();
  const skill    = String(formData.get("skill_level") ?? "");
  const status   = String(formData.get("status") ?? "active");
  const notes    = String(formData.get("notes") ?? "").trim();

  if (!fullName) return { error: "Full name is required.", success: false };

  let skillLevel: SkillLevel | undefined;
  if (skill) {
    if (!SKILL_LEVELS.includes(skill as SkillLevel)) {
      return { error: "Invalid skill level.", success: false };
    }
    skillLevel = skill as SkillLevel;
  }

  if (email && !email.includes("@")) {
    return { error: "Email looks invalid.", success: false };
  }

  try {
    await createClient({
      fullName,
      email: email || undefined,
      phone: phone || undefined,
      skillLevel,
      active: status === "active",
      notes: notes || undefined,
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")       return { error: "You don't have permission to add clients.", success: false };
    if (message === "UNAUTHENTICATED") return { error: "Your session expired. Sign in again.",     success: false };
    return { error: `Could not create client: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/clients");
  return { error: null, success: true };
}

// =============================================================
// Update an existing client
// =============================================================
export type UpdateClientState = { error: string | null; success: boolean };

export async function updateClientAction(
  _prev: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const id       = String(formData.get("client_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email    = String(formData.get("email") ?? "").trim();
  const phone    = String(formData.get("phone") ?? "").trim();
  const skill    = String(formData.get("skill_level") ?? "");
  const status   = String(formData.get("status") ?? "active");
  const notes    = String(formData.get("notes") ?? "");

  if (!id)        return { error: "Missing client id.", success: false };
  if (!fullName)  return { error: "Full name is required.", success: false };

  let skillLevel: SkillLevel | null = null;
  if (skill) {
    if (!SKILL_LEVELS.includes(skill as SkillLevel))
      return { error: "Invalid skill level.", success: false };
    skillLevel = skill as SkillLevel;
  }

  if (email && !email.includes("@"))
    return { error: "Email looks invalid.", success: false };

  try {
    await updateClient(id, {
      fullName,
      email: email === "" ? null : email,
      phone: phone === "" ? null : phone,
      skillLevel,
      active: status === "active",
      notes: notes.trim() === "" ? null : notes.trim(),
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN")       return { error: "You don't have permission to edit clients.", success: false };
    if (message === "UNAUTHENTICATED") return { error: "Your session expired. Sign in again.",       success: false };
    return { error: `Could not update client: ${message || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
  return { error: null, success: true };
}
