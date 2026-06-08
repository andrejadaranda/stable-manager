"use server";

// Farrier/vet visit server actions. The form sends a local
// "YYYY-MM-DDTHH:mm" start + a duration; we convert to ISO here (parsing
// as local time). Each selected horse carries an optional cost (euros)
// and note. RLS + the service enforce staff role.

import { revalidatePath } from "next/cache";
import {
  createFarrierVisit,
  updateFarrierVisit,
  deleteFarrierVisit,
  setFarrierHorsePaid,
} from "@/services/farrierVisits";
import type { FarrierHorseInput } from "@/services/farrierVisits.pure";
import { toFriendlyError } from "@/lib/errors/friendly";

export type FarrierActionResult = { ok: boolean; error: string | null };

function localToISO(local: string): string {
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

function parseHorses(formData: FormData): FarrierHorseInput[] {
  const ids = formData.getAll("horse_ids").map((v) => String(v)).filter(Boolean);
  return ids.map((id) => {
    const rawCost = String(formData.get(`cost_${id}`) ?? "").replace(",", ".").trim();
    const euros = rawCost === "" ? NaN : Number(rawCost);
    const cost_cents = Number.isFinite(euros) && euros >= 0 ? Math.round(euros * 100) : null;
    const note = String(formData.get(`note_${id}`) ?? "").trim() || null;
    return { horse_id: id, cost_cents, note };
  });
}

function readCommon(formData: FormData) {
  const startsLocal = String(formData.get("starts_at") ?? "");
  const duration = Number(formData.get("duration") ?? 60);
  const kind = String(formData.get("kind") ?? "farrier") === "vet" ? ("vet" as const) : ("farrier" as const);
  const farrierName = String(formData.get("farrier_name") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const horses = parseHorses(formData);
  return { startsLocal, duration, kind, farrierName, notes, horses };
}

function revalidateAll() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/my-lessons");
  revalidatePath("/dashboard/horses", "layout");
  revalidatePath("/dashboard/my-horses", "layout");
}

export async function createFarrierVisitAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const { startsLocal, duration, kind, farrierName, notes, horses } = readCommon(formData);
  if (!startsLocal) return { ok: false, error: "Pick a date and time." };
  if (horses.length === 0) return { ok: false, error: "Select at least one horse." };
  try {
    const startsISO = localToISO(startsLocal);
    const endsISO = new Date(new Date(startsISO).getTime() + Math.max(15, duration) * 60_000).toISOString();
    await createFarrierVisit({ starts_at: startsISO, ends_at: endsISO, kind, farrier_name: farrierName, notes, horses });
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function updateFarrierVisitAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing visit id." };
  const { startsLocal, duration, kind, farrierName, notes, horses } = readCommon(formData);
  if (!startsLocal) return { ok: false, error: "Pick a date and time." };
  if (horses.length === 0) return { ok: false, error: "Select at least one horse." };
  try {
    const startsISO = localToISO(startsLocal);
    const endsISO = new Date(new Date(startsISO).getTime() + Math.max(15, duration) * 60_000).toISOString();
    await updateFarrierVisit(id, { starts_at: startsISO, ends_at: endsISO, kind, farrier_name: farrierName, notes, horses });
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function toggleFarrierPaidAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const visitId = String(formData.get("visit_id") ?? "");
  const horseId = String(formData.get("horse_id") ?? "");
  const paid = String(formData.get("paid") ?? "") === "true";
  if (!visitId || !horseId) return { ok: false, error: "Missing details." };
  try {
    await setFarrierHorsePaid(visitId, horseId, paid);
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function deleteFarrierVisitAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing visit id." };
  try {
    await deleteFarrierVisit(id);
    revalidateAll();
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
