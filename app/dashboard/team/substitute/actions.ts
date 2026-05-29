"use server";

import { revalidatePath } from "next/cache";
import { bulkReassignTrainer, type ReassignResult } from "@/services/lessons";

export type SubstituteState = {
  error:  string | null;
  result: ReassignResult | null;
};

const initial: SubstituteState = { error: null, result: null };

export async function reassignAction(
  _prev: SubstituteState,
  fd: FormData,
): Promise<SubstituteState> {
  const fromId = String(fd.get("from_id") ?? "");
  const toId   = String(fd.get("to_id")   ?? "");
  const from   = String(fd.get("from_date") ?? "");
  const to     = String(fd.get("to_date")   ?? "");

  if (!fromId || !toId) return { ...initial, error: "Pick both trainers." };
  if (fromId === toId)  return { ...initial, error: "From and to trainers must differ." };
  if (!from   || !to)   return { ...initial, error: "Pick a date range." };

  // Convert date-only inputs into the full ISO range covering both days.
  const startISO = new Date(`${from}T00:00:00.000Z`).toISOString();
  const endISO   = new Date(`${to}T23:59:59.999Z`).toISOString();

  try {
    const result = await bulkReassignTrainer(fromId, toId, startISO, endISO);
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/team/substitute");
    return { error: null, result };
  } catch (err) {
    const msg = (err as Error)?.message ?? "Reassign failed.";
    if (msg === "SAME_TRAINER") {
      return { ...initial, error: "From and to trainers must differ." };
    }
    return { ...initial, error: msg };
  }
}
