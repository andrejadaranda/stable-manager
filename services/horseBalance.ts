// Aggregate everything a single horse currently owes, broken down by what
// it's for — boarding (monthly), farrier/vet (per-horse care cost), and
// other client charges. Powers the "Outstanding" card on the horse profile.

import { listChargesForHorse as listBoardingCharges } from "./boarding";
import { listChargesForHorse as listMiscCharges } from "./clientCharges";
import type { HorseOutstanding, OutstandingLine } from "./horseBalance.pure";

export type { HorseOutstanding, OutstandingLine } from "./horseBalance.pure";

const toCents = (n: number) => Math.round(n * 100);

// Farrier/vet costs live in the client-charge ledger (kinds below), so they
// no longer need a separate source — we just label those kinds nicely.
const CARE_KINDS = new Set(["farrier", "vet_copay"]);

export async function getHorseOutstanding(horseId: string): Promise<HorseOutstanding> {
  const [boarding, misc] = await Promise.all([
    listBoardingCharges(horseId).catch(() => []),
    listMiscCharges(horseId).catch(() => []),
  ]);

  const lines: OutstandingLine[] = [];

  const boardingUnpaid = boarding.filter((c) => c.payment_status !== "paid");
  const boardingCents = boardingUnpaid.reduce(
    (s, c) => s + Math.max(0, toCents(Number(c.amount) - Number(c.paid_amount))),
    0,
  );
  if (boardingCents > 0) {
    lines.push({
      label: "Boarding",
      cents: boardingCents,
      detail: `${boardingUnpaid.length} month${boardingUnpaid.length === 1 ? "" : "s"}`,
    });
  }

  const miscUnpaid = misc.filter((c) => c.payment_status !== "paid");
  const dueCents = (c: { amount: number; paid_amount: number }) =>
    Math.max(0, toCents(Number(c.amount) - Number(c.paid_amount)));

  const careRows  = miscUnpaid.filter((c) => CARE_KINDS.has(c.kind as string));
  const otherRows = miscUnpaid.filter((c) => !CARE_KINDS.has(c.kind as string));

  const careCents = careRows.reduce((s, c) => s + dueCents(c), 0);
  if (careCents > 0) {
    lines.push({
      label: "Farrier & vet",
      cents: careCents,
      detail: `${careRows.length} visit${careRows.length === 1 ? "" : "s"}`,
    });
  }

  const otherCents = otherRows.reduce((s, c) => s + dueCents(c), 0);
  if (otherCents > 0) {
    lines.push({
      label: "Other charges",
      cents: otherCents,
      detail: `${otherRows.length} item${otherRows.length === 1 ? "" : "s"}`,
    });
  }

  return { total_cents: lines.reduce((s, l) => s + l.cents, 0), lines };
}
