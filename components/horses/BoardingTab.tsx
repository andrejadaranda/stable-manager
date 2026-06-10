"use client";

// Horse boarding panel — owner-facing.
//
// Two areas:
//   1. Monthly fee — sets horses.monthly_boarding_fee for quick prefill
//      when adding a new charge.
//   2. Charges — list of past + current billing periods with one-click
//      "Mark paid" / "Mark unpaid" actions that translate to payments.
//
// Read-only fallback for non-owners: they see the data but interactive
// buttons are hidden. The page above already routes by role; this is
// defense-in-depth.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  setMonthlyFeeAction,
  createChargeAction,
  deleteChargeAction,
  markChargePaidAction,
  markChargeUnpaidAction,
  setOwnerAction,
  setLessonsAvailabilityAction,
  addNewOwnerAction,
  setBoardingStartAction,
  generateBoardingMonthsAction,
  type BoardingActionState,
} from "@/app/dashboard/horses/[id]/boarding-actions";
import type { BoardingChargeRow } from "@/services/boarding";
import type { ClientChargeRow } from "@/services/clientCharges";
import { ChargesPanel } from "@/components/clients/charges-panel";

type ClientOpt = { id: string; full_name: string };

const initialState: BoardingActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function BoardingTab({
  horseId,
  horseName,
  ownerClient,
  monthlyFee,
  boardingStartDate = null,
  availableForLessons,
  charges,
  miscCharges,
  clients,
  rates = [],
  isOwner,
  accountType = "business",
  selfDisplayName,
}: {
  horseId: string;
  horseName: string;
  ownerClient: { id: string; full_name: string } | null;
  monthlyFee: number | null;
  /** When boarding began — drives the monthly auto-generation. */
  boardingStartDate?: string | null;
  /** True if this client-owned horse is opted into the lessons dropdown. */
  availableForLessons: boolean;
  charges: BoardingChargeRow[];
  /** Misc charges (farrier, equipment, etc) tagged to this horse. */
  miscCharges: ClientChargeRow[];
  /** Active clients in the stable, used by the owner-picker on this tab. */
  clients: ClientOpt[];
  /** Stable's boarding price presets — pick one to fill the monthly fee. */
  rates?: Array<{ id: string; name: string; amount: number }>;
  isOwner: boolean;
  /** "personal" = solo B2C owner — re-themes labels to reflect that
   *  THEY are paying a stable, not billing clients. */
  accountType?: "business" | "personal";
  /** Personal account's own display name — shown as Owner. */
  selfDisplayName?: string;
}) {
  const isPersonal = accountType === "personal";

  const totalDue = charges.reduce((acc, c) => {
    const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
    return acc + remaining;
  }, 0);

  // Personal-account totals are reframed as "tracked spend" rather than
  // "outstanding billings" because the user is not billing anyone.
  const personalSpend = charges.reduce(
    (acc, c) => acc + Math.max(0, Number(c.paid_amount)),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header KPIs ---------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isPersonal ? (
          <KpiCard
            label="Owner"
            value={selfDisplayName ?? "—"}
            sub="That's you"
          />
        ) : (
          <KpiCard
            label="Owner"
            value={ownerClient?.full_name ?? "—"}
            sub={ownerClient ? "Boarding billed to" : "No owner set"}
          />
        )}
        <KpiCard
          label={isPersonal ? "Monthly fee you pay" : "Monthly fee"}
          value={monthlyFee == null ? "—" : FMT_EUR.format(Number(monthlyFee))}
          sub={isPersonal ? "To the stable, per month" : "Pre-fills new charges"}
        />
        {isPersonal ? (
          <KpiCard
            label="Spent so far"
            value={FMT_EUR.format(personalSpend)}
            sub="Across all logged expenses"
          />
        ) : (
          <KpiCard
            label="Outstanding"
            value={FMT_EUR.format(totalDue)}
            sub={totalDue > 0 ? "Across open charges" : "All paid up"}
            tone={totalDue > 0 ? "warn" : "ok"}
          />
        )}
      </div>

      {/* Personal account: gentle explainer + quick name edit link --- */}
      {isPersonal && (
        <section className="bg-cream-50/60 border border-cream-300/70 rounded-2xl p-4 flex flex-col gap-2">
          <p className="text-[13px] text-ink-700 leading-relaxed">
            This is <strong>your</strong> horse. Use this tab to track what you pay your stable each month and any extra expenses (farrier, vet, equipment).
          </p>
          <a
            href="/dashboard/settings/profile"
            className="text-[12px] text-brand-700 hover:text-brand-800 font-medium inline-flex items-center gap-1 self-start"
          >
            Edit your name → /dashboard/settings/profile
          </a>
        </section>
      )}

      {/* Owner picker — business owner only, hidden for Personal ------ */}
      {isOwner && !isPersonal && (
        <OwnerPanel
          horseId={horseId}
          currentOwner={ownerClient}
          clients={clients}
        />
      )}

      {/* Lessons-availability toggle — only meaningful when the horse
          is client-owned in a business stable. */}
      {isOwner && !isPersonal && ownerClient && (
        <LessonsAvailabilityPanel
          horseId={horseId}
          initialValue={availableForLessons}
        />
      )}

      {/* Monthly fee setter ---------------------------------------- */}
      {isOwner && (
        <MonthlyFeePanel
          horseId={horseId}
          initialFee={monthlyFee}
          isPersonal={isPersonal}
          rates={rates}
        />
      )}

      {/* Boarding schedule — start date + auto-generate monthly charges. */}
      {isOwner && !isPersonal && ownerClient && (
        <BoardingSchedulePanel
          horseId={horseId}
          initialStart={boardingStartDate}
          hasFee={monthlyFee != null}
        />
      )}

      {/* Payment calendar — 12-month grid, green=paid, amber=unpaid. */}
      {!isPersonal && charges.length > 0 && (
        <BoardingPaymentCalendar charges={charges} horseId={horseId} isOwner={isOwner} />
      )}

      {/* Misc charges (farrier, equipment, etc) — shown only when
          horse has an owner client to bill against (business only). */}
      {!isPersonal && ownerClient && (
        <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Other charges</h3>
            <p className="text-[11.5px] text-ink-500 mt-0.5">
              Farrier, equipment, supplements — anything outside the
              monthly boarding fee. Bills to {ownerClient.full_name}.
            </p>
          </div>
          <ChargesPanel
            clientId={ownerClient.id}
            charges={miscCharges}
            horseId={horseId}
            isOwner={isOwner}
            bare
          />
        </section>
      )}

      {/* Charges list ---------------------------------------------- */}
      <section className="bg-white rounded-2xl shadow-soft p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-navy-900">
            {isPersonal ? "Expenses log" : "Charges"}
          </h3>
          <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-500">
            {charges.length} {charges.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {isPersonal && (
          <p className="text-[12.5px] text-ink-500 mb-3">
            Every line here is money you've paid out for this horse. Add a line each month for the boarding fee — or log one-off costs as they come up.
          </p>
        )}

        {isOwner && (ownerClient || isPersonal) && (
          <NewChargeForm
            horseId={horseId}
            horseName={horseName}
            defaultAmount={monthlyFee}
          />
        )}
        {isOwner && !ownerClient && !isPersonal && (
          <p className="text-[12.5px] text-ink-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            Set an owner on the horse first (from the Overview tab) — boarding charges bill against the owner client.
          </p>
        )}

        {charges.length === 0 ? (
          <p className="text-sm text-ink-500 mt-2">
            {isPersonal ? "No expenses logged yet." : "No charges yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 mt-3">
            {charges.map((c) => (
              <ChargeRow key={c.id} charge={c} horseId={horseId} isOwner={isOwner} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// =============================================================
// Owner picker
// =============================================================
function OwnerPanel({
  horseId,
  currentOwner,
  clients,
}: {
  horseId: string;
  currentOwner: { id: string; full_name: string } | null;
  clients: ClientOpt[];
}) {
  const router = useRouter();
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setOwnerAction, initialState,
  );
  const [ownerId, setOwnerId] = useState<string>(currentOwner?.id ?? "");
  const dirty = ownerId !== (currentOwner?.id ?? "");

  // Inline "add a brand-new owner" — create the person, attach them here,
  // and optionally email an app invite, all without leaving the page.
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [savingNew, setSavingNew] = useState(false);
  const [newMsg, setNewMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function addNewOwner() {
    if (!newName.trim()) { setNewMsg("Owner name is required."); return; }
    setSavingNew(true);
    setNewMsg(null);
    setInviteLink(null);
    const res = await addNewOwnerAction(horseId, {
      name: newName,
      email: newEmail,
      sendInvite,
    });
    setSavingNew(false);
    if (res.error) { setNewMsg(res.error); return; }
    setShowNew(false);
    setNewName("");
    setNewEmail("");
    router.refresh();
    setInviteLink(res.inviteUrl ?? null);
    setNewMsg(
      res.invited
        ? "Owner added and invite emailed."
        : res.inviteUrl
        ? "Owner added — copy the invite link below to share it."
        : "Owner added.",
    );
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — link is still visible to select manually */
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 flex flex-col gap-3">
      <form action={action} className="flex items-end gap-3">
        <input type="hidden" name="horse_id" value={horseId} />
        <label className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
          <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
            Owner client
          </span>
          <select
            name="owner_client_id"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          >
            <option value="">— No owner —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
          {state.error && (
            <span className="text-[11px] text-rose-700 mt-0.5">{state.error}</span>
          )}
        </label>
        <SaveOwnerButton disabled={!dirty} />
      </form>

      {/* Add a brand-new owner inline */}
      {!showNew ? (
        <button
          type="button"
          onClick={() => { setShowNew(true); setNewMsg(null); }}
          className="text-[13px] font-medium text-brand-700 hover:text-brand-800 self-start"
        >
          + New owner (not in the list yet)
        </button>
      ) : (
        <div className="rounded-xl border border-ink-200 bg-cream-50/60 p-4 flex flex-col gap-3">
          <p className="text-[12px] uppercase tracking-[0.12em] text-ink-500 font-semibold">New owner</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email (optional — needed to send an invite)"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <label className="flex items-center gap-2 text-[13px] text-ink-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              disabled={!newEmail.trim()}
              className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-40"
            />
            Send app invite to this email
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addNewOwner}
              disabled={savingNew}
              className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
            >
              {savingNew ? "Adding…" : "Add owner"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setNewMsg(null); }}
              className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {newMsg && <p className="text-[12px] text-ink-500 mt-2">{newMsg}</p>}

      {inviteLink && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-ink-200 bg-cream-50/60 px-3 py-2">
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 bg-transparent text-[12px] text-ink-700 truncate focus:outline-none"
          />
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 h-8 px-3 rounded-lg bg-navy-900 text-white text-[12px] font-medium hover:bg-navy-800"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}

function SaveOwnerButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// Lessons availability (client-owned horses only)
// =============================================================
function LessonsAvailabilityPanel({
  horseId,
  initialValue,
}: {
  horseId: string;
  initialValue: boolean;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setLessonsAvailabilityAction, initialState,
  );
  const [available, setAvailable] = useState(initialValue);

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-4 flex items-start gap-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />
      <input type="hidden" name="available" value={String(available)} />
      <label className="flex items-start gap-3 cursor-pointer flex-1">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900">
            Available for stable lessons
          </p>
          <p className="text-[11.5px] text-ink-600 mt-0.5">
            Client-owned horses are hidden from the lessons dropdown by default.
            Toggle on if the owner agrees to lend this horse for trainer-led
            lessons (typically with a discount arrangement).
          </p>
          {state.error && (
            <p className="text-[11px] text-rose-700 mt-1">{state.error}</p>
          )}
        </div>
      </label>
      <SaveAvailabilityButton disabled={available === initialValue} />
    </form>
  );
}

function SaveAvailabilityButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="
        h-10 px-4 rounded-xl text-sm font-medium shrink-0
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// Monthly fee
// =============================================================
function MonthlyFeePanel({
  horseId,
  initialFee,
  isPersonal,
  rates = [],
}: {
  horseId: string;
  initialFee: number | null;
  isPersonal?: boolean;
  rates?: Array<{ id: string; name: string; amount: number }>;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    setMonthlyFeeAction, initialState,
  );
  const [fee, setFee] = useState(initialFee == null ? "" : String(initialFee));

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-4 flex flex-col gap-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />
      <div>
        <p className="text-[12px] font-semibold tracking-[0.04em] uppercase text-ink-500">
          {isPersonal ? "What you pay your stable" : "Monthly boarding fee"}
        </p>
        <p className="text-[11.5px] text-ink-500 mt-0.5 leading-relaxed">
          {isPersonal
            ? "Enter your monthly boarding cost (in EUR). Used to pre-fill recurring expense entries each month."
            : "Pick a price option or enter a custom amount. You can still override per charge."}
        </p>
      </div>

      {/* Price-option presets — one tap fills the amount, still editable. */}
      {!isPersonal && rates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rates.map((r) => {
            const active = Number(fee) === r.amount;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setFee(String(r.amount))}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-brand-700 text-white"
                    : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-100/60"
                }`}
              >
                {r.name}
                <span className={active ? "text-white/80" : "text-ink-500"}>
                  {FMT_EUR.format(r.amount)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
          <span className="text-[12px] font-medium text-ink-700">Amount · €</span>
          <input
            name="fee"
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0.00"
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              placeholder:text-ink-400 px-3 py-2.5
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
          {state.error && (
            <span className="text-[11px] text-rose-700 mt-0.5">{state.error}</span>
          )}
        </label>
        <SaveFeeButton />
      </div>
    </form>
  );
}

function SaveFeeButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-4 rounded-xl text-sm font-medium
        bg-navy-900 text-white shadow-sm hover:bg-navy-800 active:bg-navy-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

// =============================================================
// Boarding schedule — start date + one-tap monthly auto-generation.
// =============================================================
function BoardingSchedulePanel({
  horseId,
  initialStart,
  hasFee,
}: {
  horseId: string;
  initialStart: string | null;
  hasFee: boolean;
}) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveStart() {
    if (!start) { setMsg("Pick a start date."); return; }
    setSaving(true); setMsg(null);
    const res = await setBoardingStartAction(horseId, start);
    setSaving(false);
    if (res.error) { setMsg(res.error); return; }
    router.refresh();
    setMsg(res.created > 0
      ? `Saved — ${res.created} monthly charge${res.created === 1 ? "" : "s"} created. Mark each paid below.`
      : "Saved.");
  }

  async function regenerate() {
    setSaving(true); setMsg(null);
    const res = await generateBoardingMonthsAction(horseId);
    setSaving(false);
    if (res.error) { setMsg(res.error); return; }
    router.refresh();
    setMsg(res.created > 0
      ? `${res.created} new month${res.created === 1 ? "" : "s"} added.`
      : "Already up to date.");
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 flex flex-col gap-3">
      <div>
        <p className="text-[12px] font-semibold tracking-[0.04em] uppercase text-ink-500">
          Boarding since
        </p>
        <p className="text-[11.5px] text-ink-500 mt-0.5 leading-relaxed">
          Set when this horse started boarding — we create one charge per month
          up to today so you can tick off who paid each month.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[12px] font-medium text-ink-700">Start date</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </label>
        <button
          type="button"
          onClick={saveStart}
          disabled={saving || !hasFee}
          className="h-10 px-4 rounded-xl bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & fill months"}
        </button>
        {initialStart && (
          <button
            type="button"
            onClick={regenerate}
            disabled={saving}
            className="h-10 px-4 rounded-xl text-sm font-medium text-ink-700 ring-1 ring-ink-200 hover:bg-ink-100/60 disabled:opacity-50"
          >
            Catch up to this month
          </button>
        )}
      </div>
      {!hasFee && (
        <p className="text-[11.5px] text-amber-700">Set the monthly fee above first.</p>
      )}
      {msg && <p className="text-[12px] text-ink-500">{msg}</p>}
    </div>
  );
}

// =============================================================
// Payment calendar — 12-month grid of boarding charges.
// Green = paid, amber = unpaid/partial, grey = no charge that month.
// Owner can click a charged month to toggle paid/unpaid.
// =============================================================
function BoardingPaymentCalendar({
  charges,
  horseId,
  isOwner,
}: {
  charges: BoardingChargeRow[];
  horseId: string;
  isOwner: boolean;
}) {
  // Map each charge to its YYYY-MM (by period_start) → latest charge wins.
  const byMonth = new Map<string, BoardingChargeRow>();
  for (const c of charges) {
    const key = c.period_start.slice(0, 7); // YYYY-MM
    byMonth.set(key, c);
  }

  // Last 12 months ending this month, oldest → newest.
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
    });
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-navy-900">Payment calendar</h3>
        <span className="text-[11px] text-ink-500">Last 12 months</span>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {months.map((m) => {
          const charge = byMonth.get(m.key);
          const status = charge?.payment_status;
          const tone =
            !charge        ? "bg-ink-50 text-ink-300 ring-1 ring-ink-100" :
            status === "paid"    ? "bg-emerald-500 text-white" :
            status === "partial" ? "bg-amber-400 text-white" :
                                   "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
          return (
            <BoardingMonthCell
              key={m.key}
              label={m.label}
              tone={tone}
              charge={charge}
              horseId={horseId}
              isOwner={isOwner}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-ink-500">
        <Legend swatch="bg-emerald-500" text="Paid" />
        <Legend swatch="bg-rose-100 ring-1 ring-rose-200" text="Unpaid" />
        <Legend swatch="bg-amber-400" text="Partial" />
        <Legend swatch="bg-ink-50 ring-1 ring-ink-100" text="No charge" />
      </div>
    </section>
  );
}

function Legend({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${swatch}`} />
      {text}
    </span>
  );
}

function BoardingMonthCell({
  label,
  tone,
  charge,
  horseId,
  isOwner,
}: {
  label: string;
  tone: string;
  charge: BoardingChargeRow | undefined;
  horseId: string;
  isOwner: boolean;
}) {
  const paid = charge?.payment_status === "paid";
  const [, action] = useFormState<BoardingActionState, FormData>(
    paid ? markChargeUnpaidAction : markChargePaidAction,
    initialState,
  );

  const title = charge
    ? `${label}: ${FMT_EUR.format(Number(charge.amount))} · ${charge.payment_status}${isOwner ? " — tap to toggle" : ""}`
    : `${label}: no charge`;

  // Non-owner OR no charge → static cell (no toggle).
  if (!charge || !isOwner) {
    return (
      <div
        title={title}
        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold ${tone}`}
      >
        {label}
      </div>
    );
  }

  return (
    <form action={action} className="contents">
      <input type="hidden" name="charge_id" value={charge.id} />
      <input type="hidden" name="horse_id" value={horseId} />
      <input type="hidden" name="method" value="cash" />
      <button
        type="submit"
        title={title}
        className={`aspect-square w-full rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold transition-transform hover:scale-[1.05] ${tone}`}
      >
        {label}
      </button>
    </form>
  );
}

// =============================================================
// New charge inline form
// =============================================================
function NewChargeForm({
  horseId,
  horseName,
  defaultAmount,
}: {
  horseId: string;
  horseName: string;
  defaultAmount: number | null;
}) {
  const [state, action] = useFormState<BoardingActionState, FormData>(
    createChargeAction, initialState,
  );
  const [open, setOpen] = useState(false);

  // Default to the current calendar month's range so the common case
  // is one click → submit.
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().slice(0, 10);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().slice(0, 10);
  const defaultLabel = today.toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });

  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
          transition-colors
        "
      >
        + Add charge
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-ink-100 bg-surface p-4 flex flex-col gap-3 mb-3"
    >
      <input type="hidden" name="horse_id" value={horseId} />

      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-semibold">
        Charge — {horseName}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Period start" name="period_start" type="date" defaultValue={periodStart} required />
        <Field label="Period end"   name="period_end"   type="date" defaultValue={periodEnd}   required />
        <Field label="Amount · €"   name="amount"       type="number" min="0" step="0.01" defaultValue={defaultAmount != null ? String(defaultAmount) : ""} required />
      </div>
      <Field label="Label (optional)" name="period_label" defaultValue={defaultLabel} placeholder="April 2026" />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Notes (optional)
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>

      <p
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            : "sr-only"
        }
      >
        {state.error || ""}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
        >
          Cancel
        </button>
        <CreateSubmit />
      </div>
    </form>
  );
}

function CreateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Creating…" : "Create charge"}
    </button>
  );
}

// =============================================================
// Charge row
// =============================================================
function ChargeRow({
  charge,
  horseId,
  isOwner,
}: {
  charge: BoardingChargeRow;
  horseId: string;
  isOwner: boolean;
}) {
  const label =
    charge.period_label ||
    `${new Date(charge.period_start).toLocaleDateString()} → ${new Date(charge.period_end).toLocaleDateString()}`;

  const status = charge.payment_status;
  const tone =
    status === "paid"    ? "text-emerald-700" :
    status === "partial" ? "text-amber-700"   :
                           "text-ink-700";

  return (
    <li className="rounded-2xl bg-white border border-ink-100 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900 truncate">{label}</p>
        <p className={`text-[11.5px] mt-0.5 ${tone} tabular-nums`}>
          {status === "paid"
            ? `Paid · ${FMT_EUR.format(Number(charge.amount))}`
            : status === "partial"
            ? `Partial · ${FMT_EUR.format(Number(charge.paid_amount))} of ${FMT_EUR.format(Number(charge.amount))}`
            : `Unpaid · ${FMT_EUR.format(Number(charge.amount))}`}
          {charge.notes ? ` · ${charge.notes}` : ""}
        </p>
      </div>
      {isOwner && (
        <div className="flex items-center gap-1.5 flex-wrap justify-end sm:shrink-0">
          {status !== "paid" && (
            <PaidButton chargeId={charge.id} horseId={horseId} remaining={Math.max(0, Number(charge.amount) - Number(charge.paid_amount))} />
          )}
          {(status === "paid" || status === "partial") && (
            <UnpaidButton chargeId={charge.id} horseId={horseId} />
          )}
          <DeleteButton chargeId={charge.id} horseId={horseId} />
        </div>
      )}
    </li>
  );
}

function PaidButton({ chargeId, horseId, remaining }: { chargeId: string; horseId: string; remaining: number }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    markChargePaidAction, initialState,
  );
  // Amount defaults to the full remaining — record as-is for paid-in-full,
  // or type a smaller number for a partial payment.
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
      <input type="hidden" name="method"    value="cash"     />
      <span className="text-xs text-ink-400">€</span>
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        max={remaining.toFixed(2)}
        defaultValue={remaining.toFixed(2)}
        aria-label="Amount to record"
        className="h-9 w-20 rounded-xl border border-ink-200 bg-white text-xs tabular-nums px-2 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <PaidSubmit />
    </form>
  );
}

function PaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-9 px-3 rounded-xl text-xs font-semibold whitespace-nowrap
        bg-emerald-600 text-white hover:bg-emerald-700
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "Recording…" : "Record"}
    </button>
  );
}

function UnpaidButton({ chargeId, horseId }: { chargeId: string; horseId: string }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    markChargeUnpaidAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
      <UnpaidSubmit />
    </form>
  );
}

function UnpaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-9 px-3 rounded-xl text-xs font-medium whitespace-nowrap
        border border-ink-200 bg-white text-ink-700 hover:bg-ink-100/60
        disabled:opacity-50 transition-colors
      "
    >
      {pending ? "Reverting…" : "Mark unpaid"}
    </button>
  );
}

function DeleteButton({ chargeId, horseId }: { chargeId: string; horseId: string }) {
  const [, action] = useFormState<BoardingActionState, FormData>(
    deleteChargeAction, initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="horse_id"  value={horseId}  />
      <DeleteSubmit />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Delete this charge? Linked payments stay but are detached.")) e.preventDefault();
      }}
      className="h-9 px-2 rounded-xl text-[11px] text-ink-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

// =============================================================
// Primitives
// =============================================================
function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "ok" | "warn";
}) {
  const valueClass =
    tone === "warn" ? "text-amber-700" :
    tone === "ok"   ? "text-emerald-700" :
                      "text-navy-900";
  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        {label}
      </p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11.5px] text-ink-500 mt-0.5">{sub}</p>
    </div>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      <input
        className="
          rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3 py-2.5
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
        {...rest}
      />
    </label>
  );
}
