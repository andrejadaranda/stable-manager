"use server";

// Server actions for horse health records. Thin wrappers over the
// service layer that translate clean error tokens into user-facing
// strings, then revalidate the horse profile page.

import { revalidatePath } from "next/cache";
import {
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
  HEALTH_RECORD_KINDS,
  type HealthRecordKind,
} from "@/services/horseHealth";

// =============================================================
// Create
// =============================================================
export type CreateHealthState = { error: string | null; success: boolean };

export async function createHealthRecordAction(
  _prev: CreateHealthState,
  formData: FormData,
): Promise<CreateHealthState> {
  const horseId       = String(formData.get("horse_id") ?? "");
  const kindRaw       = String(formData.get("kind") ?? "");
  const occurredOnRaw = String(formData.get("occurred_on") ?? "");
  const nextDueRaw    = String(formData.get("next_due_on") ?? "").trim();
  const resolvedRaw   = String(formData.get("resolved_on") ?? "").trim();
  const titleRaw      = String(formData.get("title") ?? "").trim();
  const notesRaw      = String(formData.get("notes") ?? "").trim();

  if (!horseId) return { error: "Missing horse id.", success: false };
  if (!HEALTH_RECORD_KINDS.includes(kindRaw as HealthRecordKind)) {
    return { error: "Pick a record type.", success: false };
  }
  if (!occurredOnRaw) return { error: "When did it happen?", success: false };
  if (!titleRaw)      return { error: "Add a short title.", success: false };

  try {
    await createHealthRecord({
      horseId,
      kind: kindRaw as HealthRecordKind,
      occurredOn: occurredOnRaw,
      nextDueOn:  nextDueRaw  || null,
      resolvedOn: resolvedRaw || null,
      title: titleRaw,
      notes: notesRaw || null,
    });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission to add health records.", success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.",                  success: false };
    if (m === "INVALID_TITLE")   return { error: "Title is required.",                               success: false };
    return { error: `Could not add record: ${m || "unknown error"}.`, success: false };
  }

  revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

// =============================================================
// Resolve injury (sets resolved_on = today)
// =============================================================
export type ResolveInjuryState = { error: string | null; success: boolean };

export async function resolveInjuryAction(
  _prev: ResolveInjuryState,
  formData: FormData,
): Promise<ResolveInjuryState> {
  const id      = String(formData.get("record_id") ?? "");
  const horseId = String(formData.get("horse_id") ?? "");
  if (!id) return { error: "Missing record id.", success: false };

  try {
    const today = new Date().toISOString().slice(0, 10);
    await updateHealthRecord(id, { resolvedOn: today });
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission.",                  success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.",            success: false };
    return { error: `Could not resolve: ${m || "unknown error"}.`, success: false };
  }

  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}

// =============================================================
// Delete
// =============================================================
export type DeleteHealthState = { error: string | null; success: boolean };

export async function deleteHealthRecordAction(
  _prev: DeleteHealthState,
  formData: FormData,
): Promise<DeleteHealthState> {
  const id      = String(formData.get("record_id") ?? "");
  const horseId = String(formData.get("horse_id") ?? "");
  if (!id) return { error: "Missing record id.", success: false };

  try {
    await deleteHealthRecord(id);
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FORBIDDEN")       return { error: "You don't have permission.",      success: false };
    if (m === "UNAUTHENTICATED") return { error: "Session expired. Sign in again.", success: false };
    return { error: `Could not delete: ${m || "unknown error"}.`, success: false };
  }

  if (horseId) revalidatePath(`/dashboard/horses/${horseId}`);
  return { error: null, success: true };
}
