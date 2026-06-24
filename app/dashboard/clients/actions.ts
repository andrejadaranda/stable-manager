"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClient,
  updateClient,
  deleteClient,
  sendClientOnboardingInvitation,
  type SkillLevel,
  type ReminderPref,
} from "@/services/clients";
import { ONBOARDING_ENABLED } from "@/lib/config/onboarding";

export type OnboardingActionState = {
  error: string | null;
  success: boolean;
  sentTo?: string;
  sentAt?: string;
};

export async function sendOnboardingInvitationAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  if (!ONBOARDING_ENABLED) return { error: "Onboarding is currently disabled.", success: false };
  const id = String(formData.get("client_id") ?? "");
  if (!id) return { error: "Missing client id.", success: false };
  const res = await sendClientOnboardingInvitation(id).catch((err) => ({
    ok: false as const,
    code: "SEND_FAILED" as const,
    message: `Unexpected error: ${err?.message ?? "unknown"}.`,
  }));
  if (!res.ok) return { error: res.message, success: false };
  revalidatePath(`/dashboard/clients/${id}`);
  return { error: null, success: true, sentTo: res.sentTo, sentAt: res.sentAt };
}

export type DeleteClientState = { error: string | null };

export async function deleteClientAction(
  _prev: DeleteClientState,
  formData: FormData,
): Promise<DeleteClientState> {
  const id = String(formData.get("client_id") ?? "");
  if (!id) return { error: "Missing client id." };
  try {
    await deleteClient(id);
  } catch (err: any) {
    const m = err?.message ?? "";
    if (m === "CLIENT_HAS_HISTORY")
      return { error: "This client has lessons, horses, charges or payments on file — deactivate them instead of deleting (this keeps the records)." };
    if (m === "FORBIDDEN") return { error: "Only the owner can delete clients." };
    return { error: `Could not delete: ${m || "unknown error"}.` };
  }
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}

export type CreateClientState = { error: string | null; success: boolean };

const initial: CreateClientState = { error: null, success: false };

const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "pro"];
const REMINDER_PREFS: ReminderPref[] = ["none", "email", "sms", "both"];

export async function createClientAction(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const fullName     = String(formData.get("full_name") ?? "").trim();
  const email        = String(formData.get("email") ?? "").trim();
  const phone        = String(formData.get("phone") ?? "").trim();
  const skill        = String(formData.get("skill_level") ?? "");
  const status       = String(formData.get("status") ?? "active");
  const notes        = String(formData.get("notes") ?? "").trim();
  const reminderRaw  = String(formData.get("reminder_pref") ?? "none");

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

  // Reminder preference: validate enum + enforce channel availability.
  // Email path requires an email. SMS path requires a phone AND is
  // post-launch (cron lands in #34) — we still store the preference so
  // that when SMS goes live we can start firing reminders immediately
  // for clients who opted in at signup time.
  if (!REMINDER_PREFS.includes(reminderRaw as ReminderPref)) {
    return { error: "Invalid reminder preference.", success: false };
  }
  const reminderPref = reminderRaw as ReminderPref;

  if ((reminderPref === "email" || reminderPref === "both") && !email) {
    return {
      error: "Email reminder selected but no email provided.",
      success: false,
    };
  }
  if ((reminderPref === "sms" || reminderPref === "both") && !phone) {
    return {
      error: "SMS reminder selected but no phone provided.",
      success: false,
    };
  }

  try {
    await createClient({
      fullName,
      email: email || undefined,
      phone: phone || undefined,
      skillLevel,
      active: status === "active",
      notes: notes || undefined,
      reminderPref,
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
  const ecName     = String(formData.get("emergency_contact_name") ?? "").trim();
  const ecPhone    = String(formData.get("emergency_contact_phone") ?? "").trim();
  const ecRelation = String(formData.get("emergency_contact_relation") ?? "").trim();
  const horseOwnerOnly = formData.get("is_horse_owner_only") === "true";
  // Reminder preference is optional on update — only included when the
  // edit form actually submits it, so legacy forms still work.
  const reminderRaw = formData.get("reminder_pref");
  const reminderPref =
    reminderRaw === null
      ? undefined
      : (String(reminderRaw) as ReminderPref);

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

  if (reminderPref !== undefined) {
    if (!REMINDER_PREFS.includes(reminderPref)) {
      return { error: "Invalid reminder preference.", success: false };
    }
    if ((reminderPref === "email" || reminderPref === "both") && !email) {
      return {
        error: "Email reminder selected but no email provided.",
        success: false,
      };
    }
    if ((reminderPref === "sms" || reminderPref === "both") && !phone) {
      return {
        error: "SMS reminder selected but no phone provided.",
        success: false,
      };
    }
  }

  try {
    await updateClient(id, {
      fullName,
      email: email === "" ? null : email,
      phone: phone === "" ? null : phone,
      skillLevel,
      active: status === "active",
      notes: notes.trim() === "" ? null : notes.trim(),
      emergencyContactName:     ecName     === "" ? null : ecName,
      emergencyContactPhone:    ecPhone    === "" ? null : ecPhone,
      emergencyContactRelation: ecRelation === "" ? null : ecRelation,
      isHorseOwnerOnly:         horseOwnerOnly,
      reminderPref,
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
