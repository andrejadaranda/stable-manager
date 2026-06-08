// Aggregate everything a single horse currently owes, broken down by what
// it's for — boarding (monthly), farrier/vet (per-horse care cost), and
// other client charges. Powers the "Outstanding" card on the horse profile.

import { listChargesForHorse as listBoardingCharges } from "./boarding";
import { listChargesForHorse as listMiscCharges } from "./clientCharges";
import { getCareVisitsForHorse } from "./farrierVisits";
import type { HorseOutstanding, OutstandingLine } from "./horseBalance.pure";

export type { HorseOutstanding, OutstandingLine } from "./horseBalance.pure";

const toCents = (n: number) => Math.round(n * 100);

export async function getHorseOutstanding(horseId: string): Promise<HorseOutstanding> {
  const [boarding, misc, care] = await Promise.all([
    listBoardingCharges(horseId).catch(() => []),
    listMiscCharges(horseId).catch(() => []),
    getCareVisitsForHorse(horseId).catch(() => []),
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

  const careUnpaid = care.filter((v) => v.cost_cents != null && !v.paid_at);
  const careCents = careUnpaid.reduce((s, v) => s + (v.cost_cents ?? 0), 0);
  if (careCents > 0) {
    lines.push({
      label: "Farrier & vet",
      cents: careCents,
      detail: `${careUnpaid.length} visit${careUnpaid.length === 1 ? "" : "s"}`,
    });
  }

  const miscUnpaid = misc.filter((c) => c.payment_status !== "paid");
  const miscCents = miscUnpaid.reduce(
    (s, c) => s + Math.max(0, toCents(Number(c.amount) - Number(c.paid_amount))),
    0,
  );
  if (miscCents > 0) {
    lines.push({
      label: "Other charges",
      cents: miscCents,
      detail: `${miscUnpaid.length} item${miscUnpaid.length === 1 ? "" : "s"}`,
    });
  }

  return { total_cents: lines.reduce((s, l) => s + l.cents, 0), lines };
}
