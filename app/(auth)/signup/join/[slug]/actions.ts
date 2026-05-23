"use server";

// Public anon-callable server action for submitting a stable-join
// application. RLS on stable_join_requests enforces:
//   * status='pending' on insert (we set it server-side anyway)
//   * stable_id must reference a stable with accepts_public_join=true
// Both shields are belt-and-braces with the same checks here.

import { redirect } from "next/navigation";
import {
  getPublicStableBySlug,
  submitJoinRequest,
  type JoinRequestRole,
} from "@/services/joinRequests";

export type JoinSubmitState = {
  error:   string | null;
  success: boolean;
};

const initial: JoinSubmitState = { error: null, success: false };

const ALLOWED_ROLES: JoinRequestRole[] = ["rider", "horse_owner"];

export async function submitJoinAction(
  _prev: JoinSubmitState,
  formData: FormData,
): Promise<JoinSubmitState> {
  const slug     = String(formData.get("slug") ?? "").trim().toLowerCase();
  const roleRaw  = String(formData.get("role") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email    = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone    = String(formData.get("phone") ?? "").trim();
  const message  = String(formData.get("message") ?? "").trim();

  if (!slug)                                         return { ...initial, error: "Missing stable." };
  if (!ALLOWED_ROLES.includes(roleRaw as never))     return { ...initial, error: "Pick rider or horse owner." };
  if (fullName.length < 2)                           return { ...initial, error: "Please enter your full name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))     return { ...initial, error: "Enter a valid email address." };

  const stable = await getPublicStableBySlug(slug);
  if (!stable)                       return { ...initial, error: "That stable doesn't exist." };
  if (!stable.accepts_public_join)   return { ...initial, error: "This stable is not accepting applications right now." };

  try {
    await submitJoinRequest({
      stableId:      stable.id,
      requestedRole: roleRaw as JoinRequestRole,
      fullName,
      email,
      phone:         phone.length > 0 ? phone : null,
      message:       message.length > 0 ? message : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not submit your application.";
    return { ...initial, error: msg };
  }

  redirect(`/signup/join/${slug}/sent`);
}
