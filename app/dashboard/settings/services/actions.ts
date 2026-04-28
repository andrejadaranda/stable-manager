"use server";

import { revalidatePath } from "next/cache";
import {
  createService,
  updateService,
  deleteService,
} from "@/services/services";
import { toFriendlyError } from "@/lib/errors/friendly";

export type ServiceActionState = {
  error: string | null;
  success: boolean;
};

const initial: ServiceActionState = { error: null, success: false };

function parseInputs(formData: FormData) {
  return {
    name:        String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    basePriceR:  String(formData.get("base_price") ?? "").trim(),
    durationR:   String(formData.get("default_duration_minutes") ?? "").trim(),
    sortOrderR:  String(formData.get("sort_order") ?? "").trim(),
    activeR:     String(formData.get("active") ?? "true"),
  };
}

export async function createServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const i = parseInputs(formData);
  if (!i.name) return { ...initial, error: "Name is required." };

  const basePrice = Number(i.basePriceR);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { ...initial, error: "Price must be a non-negative number." };
  }

  const duration = Number.parseInt(i.durationR, 10) || 45;

  try {
    await createService({
      name: i.name,
      description: i.description || null,
      basePrice,
      defaultDurationMinutes: duration,
      sortOrder: Number.parseInt(i.sortOrderR, 10) || 0,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/settings/services");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function updateServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const id = String(formData.get("service_id") ?? "");
  if (!id) return { ...initial, error: "Missing service id." };

  const i = parseInputs(formData);
  if (!i.name) return { ...initial, error: "Name is required." };

  const basePrice = Number(i.basePriceR);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { ...initial, error: "Price must be a non-negative number." };
  }

  const duration = Number.parseInt(i.durationR, 10) || 45;
  const active = i.activeR !== "false";

  try {
    await updateService(id, {
      name: i.name,
      description: i.description || null,
      basePrice,
      defaultDurationMinutes: duration,
      sortOrder: Number.parseInt(i.sortOrderR, 10) || 0,
      active,
    });
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/settings/services");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}

export async function deleteServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const id = String(formData.get("service_id") ?? "");
  if (!id) return { ...initial, error: "Missing service id." };

  try {
    await deleteService(id);
  } catch (err) {
    return { ...initial, error: toFriendlyError(err).message };
  }

  revalidatePath("/dashboard/settings/services");
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}
