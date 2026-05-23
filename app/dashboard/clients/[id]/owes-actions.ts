"use server";

// =============================================================
// Single mark-paid action for the Owes Breakdown panel.
//
// The breakdown UI mixes three different unpaid-item kinds in one
// timeline (lessons, misc charges, boarding charges). Rather than
// rendering 3 different forms wired to 3 different actions, the panel
// emits a single form whose hidden `type` field tells this action
// where to dispatch. This keeps the UI dumb (one button per row, one
// form shape) and the routing centralised.
//
// Owner-only — RLS guards the writes, and the service helpers each
// re-assert role for defence in depth.
// =============================================================

import { revalidatePath } from "next/cache";
import { getSession, requireRole } from "@/lib/auth/session";
import { addPayment } from "@/services/payments";
import { markClientChargePaid } from "@/services/clientCharges";
import { markChargePaid as markBoardingChargePaid } from "@/services/boarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MarkOwedPaidState = {
  error: string | null;
  success: boolean;
};

const initial: MarkOwedPaidState = { error: null, success: false };

type Method = "cash" | "card" | "transfer" | "other";

function normalizeMethod(raw: string): Method {
  return raw === "card" || raw === "transfer" || raw === "other" ? raw : "cash";
}

export async function markOwedPaidAction(
  _prev: MarkOwedPaidState,
  formData: FormData,
): Promise<MarkOwedPaidState> {
  const kind     = String(formData.get("kind") ?? "");
  const itemId   = String(formData.get("item_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const method   = normalizeMethod(String(formData.get("method") ?? "cash"));

  if (!itemId || !clientId || !kind) {
    return { ...initial, error: "Missing item id or kind." };
  }

  try {
    const session = await getSession();
    requireRole(session, "owner");

    if (kind === "lesson") {
      // Inline-rebuild of markLessonPaidAction so the breakdown panel
      // doesn't depend on calendar/actions.ts (kept the calendar
      // version in place — both paths revalidate their own page).
      const supabase = createSupabaseServerClient();
      const { data: lesson, error } = await supabase
        .from("lessons")
        .select("id, client_id, price, package_id")
        .eq("id", itemId)
        .maybeSingle();
      if (error || !lesson) {
        return { ...initial, error: "Lesson not found." };
      }
      const l = lesson as {
        id: string;
        client_id: string;
        price: number;
        package_id: string | null;
      };
      if (l.package_id) {
        return {
          ...initial,
          error: "Covered by a package — no payment needed.",
        };
      }
      if (Number(l.price) <= 0) {
        return { ...initial, error: "Lesson price is 0." };
      }
      // Subtract anything already paid so partial-payment lessons
      // close cleanly when the owner marks the rest received.
      const { data: paidRows } = await supabase
        .from("payments")
        .select("amount")
        .eq("lesson_id", itemId);
      const alreadyPaid = (paidRows ?? []).reduce(
        (s, p) => s + Number((p as { amount: number }).amount ?? 0),
        0,
      );
      const remaining = Number(l.price) - alreadyPaid;
      if (remaining <= 0) {
        // Already paid; pretend it succeeded so the UI just refreshes.
        revalidatePath(`/dashboard/clients/${clientId}`);
        return { error: null, success: true };
      }
      await addPayment({
        clientId: l.client_id,
        amount:   remaining,
        method,
        lessonId: l.id,
      });
    } else if (kind === "charge") {
      await markClientChargePaid(itemId, method);
    } else if (kind === "boarding") {
      await markBoardingChargePaid(itemId, method);
    } else {
      return { ...initial, error: `Unknown item kind: ${kind}` };
    }
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message === "FORBIDDEN") {
      return { ...initial, error: "Only owners can record payments." };
    }
    return { ...initial, error: `Could not mark paid: ${message || "unknown error"}.` };
  }

  // Refresh both the client detail (balance + breakdown) and the
  // calendar (the lesson card's paid badge flips).
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/calendar");
  return { error: null, success: true };
}
