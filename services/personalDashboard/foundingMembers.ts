// The Founding 15 roster.
//
// This is a hand-maintained list, and that is not a shortcut — it is the
// only correct model. Founding Members agreed to €25/mo locked for life
// after twelve free months, they are onboarded and invoiced personally,
// and they never touch Stripe checkout (see app/api/stripe/checkout/route.ts).
// There is therefore nothing in the product schema to derive them from:
// no subscription row, no plan value, no flag. A "founding member" is a
// commercial commitment that exists in her inbox, not in the database.
//
// So the dashboard stores the commitment, and links it to a stable once
// the member actually signs up. That link is what lets the card separate
// "15 people said yes" from "9 of them are using it".

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePersonalContext, safe, num } from "@/services/personalDashboard/common";

export type FoundingStatus = "committed" | "active" | "churned";

export type FoundingMemberRow = {
  id: string;
  fullName: string;
  email: string | null;
  status: FoundingStatus;
  monthlyEur: number;
  joinedOn: string | null;
  notes: string | null;
};

export async function listFoundingMembers(): Promise<FoundingMemberRow[]> {
  return safe<FoundingMemberRow[]>(
    async () => {
      await requirePersonalContext();
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("founding_members")
        .select("id, full_name, email, status, monthly_eur, joined_on, notes")
        // Committed first (they are the ones needing a nudge), then
        // active, then churned — which is `status` reverse-alphabetical.
        .order("status", { ascending: false })
        .order("full_name", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((r) => ({
        id: String(r.id),
        fullName: String(r.full_name),
        email: (r.email as string) ?? null,
        status: String(r.status) as FoundingStatus,
        monthlyEur: num(r.monthly_eur),
        joinedOn: (r.joined_on as string) ?? null,
        notes: (r.notes as string) ?? null,
      }));
    },
    [],
    "listFoundingMembers",
  );
}

export async function addFoundingMember(input: {
  fullName: string;
  email?: string | null;
  status?: FoundingStatus;
  monthlyEur?: number;
  joinedOn?: string | null;
  notes?: string | null;
}): Promise<void> {
  await requirePersonalContext();
  const supabase = createSupabaseServerClient();

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Įvesk vardą.");

  const { error } = await supabase.from("founding_members").insert({
    full_name: fullName,
    email: input.email?.trim() || null,
    status: input.status ?? "committed",
    monthly_eur:
      Number.isFinite(input.monthlyEur) && (input.monthlyEur as number) >= 0
        ? input.monthlyEur
        : 25,
    joined_on: input.joinedOn || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function setFoundingMemberStatus(
  id: string,
  status: FoundingStatus,
): Promise<void> {
  await requirePersonalContext();
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };

  // Reaching 'active' is the moment they started using it, so stamp the
  // date — but only if it isn't already known. Overwriting a date she
  // set herself (or an earlier activation) would quietly rewrite history.
  if (status === "active") {
    const { data: existing } = await supabase
      .from("founding_members")
      .select("joined_on")
      .eq("id", id)
      .maybeSingle();
    if (!existing?.joined_on) {
      patch.joined_on = new Date().toISOString().slice(0, 10);
    }
  }

  const { error } = await supabase.from("founding_members").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteFoundingMember(id: string): Promise<void> {
  await requirePersonalContext();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("founding_members").delete().eq("id", id);
  if (error) throw error;
}
