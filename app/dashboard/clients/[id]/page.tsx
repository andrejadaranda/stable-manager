import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getClient, getClientOnboarding, type SkillLevel } from "@/services/clients";
import { ONBOARDING_ENABLED } from "@/lib/config/onboarding";
import { getClientLessons, type ClientLessonRow } from "@/services/lessons";
import { getClientBalance, listClientOwedItems } from "@/services/payments";
import { listClientPackages } from "@/services/packages";
import { listChargesForClient } from "@/services/boarding";
import { listClientAgreements } from "@/services/agreements";
import { listClientCharges } from "@/services/clientCharges";
import { fmtTime } from "@/lib/utils/dates";
import { EditClientButton } from "@/components/clients/edit-client-dialog";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { PackagePanel } from "@/components/clients/package-panel";
import { ClientBoardingSection } from "@/components/clients/client-boarding-section";
import { AgreementsPanel } from "@/components/clients/agreements-panel";
import { ChargesPanel } from "@/components/clients/charges-panel";
import { OwesBreakdown } from "@/components/clients/owes-breakdown";
import { InviteToAppButton } from "@/components/clients/invite-to-app-button";
import { OnboardingInviteButton } from "@/components/clients/onboarding-invite-button";
import { getPendingInviteForClient } from "@/services/invitations";
import { generateClientInvoiceAction } from "./invoice-actions";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

// RFC-4122 UUID guard — see /horses/[id]/page.tsx for rationale.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Owner + employee may view the page. Balance is gated below.
  const session = await requirePageRole("owner", "employee");

  if (!UUID_RE.test(params.id)) notFound();

  const client = await getClient(params.id);
  if (!client) notFound();

  const [upcoming, recent, packages, boardingCharges, agreements, miscCharges] = await Promise.all([
    getClientLessons(params.id, { direction: "upcoming", limit: 10 }),
    getClientLessons(params.id, { direction: "recent",   limit: 10 }),
    listClientPackages(params.id),
    listChargesForClient(params.id),
    listClientAgreements(params.id),
    listClientCharges(params.id),
  ]);

  // Owner-only: payment balance + owes breakdown + pending invite check.
  // The owes breakdown is only worth fetching when the client actually
  // owes money (balance < 0). Pending-invite is needed to decide whether
  // to render "Invite to app" vs "Resend invite".
  let balance: number | null = null;
  let owedItems: Awaited<ReturnType<typeof listClientOwedItems>> = [];
  let hasPendingInvite = false;
  if (session.role === "owner") {
    balance = await getClientBalance(params.id);
    if (balance !== null && balance < 0) {
      owedItems = await listClientOwedItems(params.id);
    }
    const pending = await getPendingInviteForClient(params.id).catch(() => null);
    hasPendingInvite = pending !== null;
  }

  // Onboarding-invitation state (Phase 1) — staff (owner + employee) can
  // send the first-lesson invitation. Best-effort; never blocks the page.
  // Parked behind ONBOARDING_ENABLED while we decide where onboarding lives.
  const onboarding = ONBOARDING_ENABLED
    ? await getClientOnboarding(params.id).catch(() => null)
    : null;

  const initial = client.full_name?.[0]?.toUpperCase() ?? "?";

  // Role shape drives the layout. A client who owns boarded horses but
  // books no lessons is a "horse owner / boarder" — leading their profile
  // with empty lesson lists looks broken, so we surface boarding instead.
  const isHorseOwner = boardingCharges.length > 0;
  const hasLessons = upcoming.length > 0 || recent.length > 0;
  const isHorseOwnerOnly = isHorseOwner && !hasLessons;

  const notesBlock = client.notes ? (
    <section className="border border-neutral-200 rounded-md bg-white p-4">
      <h2 className="text-sm font-medium mb-2">Notes</h2>
      <p className="text-sm whitespace-pre-wrap text-neutral-800">{client.notes}</p>
    </section>
  ) : null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/dashboard/clients"
        className="text-sm text-ink-500 hover:text-ink-900 w-fit inline-flex items-center gap-1"
      >
        <span aria-hidden>←</span> Clients
      </Link>

      {/* Magazine hero */}
      <header className="relative bg-white rounded-3xl shadow-soft overflow-hidden">
        {/* Green banner */}
        <div className="h-32 w-full bg-gradient-to-br from-brand-700 to-brand-900" aria-hidden />

        <div className="px-5 md:px-7 pb-6">
          {/* Tan avatar, centered, overlapping the banner */}
          <div className="-mt-16 flex justify-center">
            <div className="w-[104px] h-[104px] rounded-[28px] ring-[5px] ring-surface shadow-lift inline-flex items-center justify-center bg-gradient-to-br from-saddle-400 to-saddle-600">
              <span className="text-white text-[44px] font-bold leading-none">{initial}</span>
            </div>
          </div>

          <h1 className="font-serif font-semibold text-[27px] leading-tight text-ink-900 text-center mt-4">
            {client.full_name}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full ${
                client.active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600"
              }`}
            >
              <span className={`w-[7px] h-[7px] rounded-full ${client.active ? "bg-brand-500" : "bg-ink-400"}`} />
              {client.active ? "Active" : "Inactive"}
            </span>
            <span className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-surface-sunken text-ink-600">
              {isHorseOwnerOnly
                ? "Horse owner"
                : `Rider${client.skill_level && hasLessons ? ` · ${SKILL_LABEL[client.skill_level]}` : ""}`}
            </span>
            {isHorseOwner && !isHorseOwnerOnly && (
              <span
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-saddle-50 text-saddle-700"
                title="Takes lessons and owns a horse boarded here — billed for both."
              >
                Rider + owner
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
            {onboarding && (
              <OnboardingInviteButton
                clientId={client.id}
                status={onboarding.status}
                sentAt={onboarding.sent_at}
                sentTo={onboarding.sent_to}
              />
            )}
            {session.role === "owner" && (
              <InviteToAppButton
                clientId={client.id}
                hasPortalAccount={Boolean(client.profile_id)}
                hasPendingInvite={hasPendingInvite}
                hasEmail={Boolean(client.email)}
              />
            )}
            <EditClientButton client={client} />
            {session.role === "owner" && <DeleteClientButton clientId={client.id} />}
          </div>

          {/* Contact fields — cream boxes */}
          <div className="mt-5 flex flex-col gap-2.5">
            <div className="px-4 py-3.5 bg-ink-50 rounded-2xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Phone</div>
              <div className="text-[16px] font-medium text-ink-900 mt-1">
                {client.phone ? (
                  <a href={`tel:${client.phone.replace(/\s+/g, "")}`} className="hover:underline">{client.phone}</a>
                ) : <span className="text-ink-300">—</span>}
              </div>
            </div>
            <div className="px-4 py-3.5 bg-ink-50 rounded-2xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Email</div>
              <div className="text-[16px] font-medium text-ink-900 mt-1 break-all">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                ) : <span className="text-ink-300">—</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      {(client.emergency_contact_name || client.emergency_contact_phone) && (
        <section className="bg-rose-50/40 border border-rose-200 rounded-2xl p-5">
          <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-rose-700">
            Emergency contact
          </h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            {client.emergency_contact_name && (
              <span className="font-semibold text-navy-900">{client.emergency_contact_name}</span>
            )}
            {client.emergency_contact_relation && (
              <span className="text-[12px] text-ink-500">({client.emergency_contact_relation})</span>
            )}
            {client.emergency_contact_phone && (
              <a
                href={`tel:${client.emergency_contact_phone.replace(/\s+/g, "")}`}
                className="text-rose-700 font-medium tabular-nums hover:underline"
              >
                {client.emergency_contact_phone}
              </a>
            )}
          </div>
        </section>
      )}

      {(() => {
        const g = client as typeof client & {
          guardian_name?: string | null;
          guardian_phone?: string | null;
          guardian_relation?: string | null;
          is_minor?: boolean | null;
        };
        if (!g.guardian_name && !g.guardian_phone) return null;
        const relLabel = g.guardian_relation === "mother" ? "Mother"
          : g.guardian_relation === "father" ? "Father"
          : g.guardian_relation === "guardian" ? "Guardian"
          : "Parent / guardian";
        return (
          <section className="bg-brand-50/40 border border-brand-200 rounded-2xl p-5">
            <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700">
              {relLabel} · contact
            </h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              {g.guardian_name && (
                <span className="font-semibold text-navy-900">{g.guardian_name}</span>
              )}
              {g.guardian_phone && (
                <a
                  href={`tel:${g.guardian_phone.replace(/\s+/g, "")}`}
                  className="text-brand-700 font-medium tabular-nums hover:underline"
                >
                  {g.guardian_phone}
                </a>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-500">
              This is the child&apos;s contact — the parent is not a separate client.
            </p>
          </section>
        );
      })()}

      {session.role === "owner" && (
        <>
          <section className="bg-white rounded-2xl shadow-soft p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
                Balance
              </h2>
              <div className="mt-2">
                <BalanceLine balance={balance} />
              </div>
            </div>
            <form action={generateClientInvoiceAction}>
              <input type="hidden" name="client_id" value={client.id} />
              <button
                type="submit"
                className="
                  h-10 px-4 rounded-xl text-sm font-medium
                  text-brand-700 bg-brand-50 hover:bg-brand-100
                  transition-colors inline-flex items-center gap-1.5
                "
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                  <path d="M14 2v6h6M9 13h6M9 17h4" />
                </svg>
                Create invoice
              </button>
            </form>
          </section>

          {/* Owes breakdown — only rendered when the client actually
              owes money. We pass the balance as the source-of-truth so
              the panel can flag any divergence (typically a credit/
              prepayment on the account). */}
          {balance !== null && balance < 0 && (
            <OwesBreakdown
              clientId={client.id}
              items={owedItems}
              totalOwedFromBalance={Math.abs(balance)}
            />
          )}
        </>
      )}

      {isHorseOwnerOnly ? (
        /* Boarder / horse-owner layout — boarding leads, no lesson noise. */
        <>
          <ClientBoardingSection charges={boardingCharges} />

          <ChargesPanel
            clientId={client.id}
            charges={miscCharges}
            isOwner={session.role === "owner"}
          />

          <AgreementsPanel
            clientId={client.id}
            agreements={agreements}
            hasBoardedHorses
            isOwner={session.role === "owner"}
          />

          {notesBlock}

          <p className="text-[12px] text-ink-500 bg-ink-50/60 rounded-xl px-4 py-3">
            This client boards {boardingCharges.length === 1 ? "a horse" : "horses"} but
            isn&apos;t enrolled in lessons. Book a lesson to add them to the
            schedule, or keep managing their boarding above.
          </p>
        </>
      ) : (
        /* Rider layout (incl. riders who also own boarded horses). */
        <>
          <PackagePanel
            clientId={client.id}
            packages={packages}
            isOwner={session.role === "owner"}
          />

          {boardingCharges.length > 0 && (
            <ClientBoardingSection charges={boardingCharges} />
          )}

          <ChargesPanel
            clientId={client.id}
            charges={miscCharges}
            isOwner={session.role === "owner"}
          />

          <AgreementsPanel
            clientId={client.id}
            agreements={agreements}
            hasBoardedHorses={boardingCharges.length > 0}
            isOwner={session.role === "owner"}
          />

          {notesBlock}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Upcoming lessons</h2>
            <LessonList lessons={upcoming} empty="No upcoming lessons." />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Recent lessons</h2>
            <LessonList lessons={recent} empty="No past lessons yet." />
          </section>
        </>
      )}
    </div>
  );
}

// ---------- helpers ----------
function BalanceLine({ balance }: { balance: number | null }) {
  if (balance == null) {
    return <p className="text-sm text-neutral-500">—</p>;
  }
  const formatted = balance.toFixed(2);
  if (balance < 0) {
    return <p className="text-sm text-red-700 font-medium">Owes {Math.abs(balance).toFixed(2)}</p>;
  }
  if (balance > 0) {
    return <p className="text-sm text-emerald-700 font-medium">Credit {formatted}</p>;
  }
  return <p className="text-sm text-neutral-700">Settled (0.00)</p>;
}

function LessonList({
  lessons,
  empty,
}: {
  lessons: ClientLessonRow[];
  empty: string;
}) {
  if (lessons.length === 0) {
    return <p className="text-[14.5px] text-ink-400 italic">{empty}</p>;
  }
  const STATUS_TAG: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "Scheduled", cls: "text-saddle-700 bg-saddle-100" },
    completed: { label: "Completed", cls: "text-brand-700 bg-brand-50" },
    cancelled: { label: "Cancelled", cls: "text-ink-500 bg-ink-100" },
    no_show:   { label: "No show",   cls: "text-alert-700 bg-alert-100" },
  };
  return (
    <div className="flex flex-col gap-3">
      {lessons.map((l) => {
        const d = new Date(l.starts_at);
        const day = d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Europe/Vilnius" });
        const mon = d.toLocaleDateString("en-GB", { month: "short", timeZone: "Europe/Vilnius" });
        const tag = STATUS_TAG[l.status] ?? STATUS_TAG.scheduled;
        return (
          <div key={l.id} className="bg-white border border-ink-100 rounded-2xl shadow-soft px-4 py-3.5 flex items-center gap-3.5">
            <div className="w-[52px] text-center shrink-0">
              <div className="font-mono font-semibold text-[22px] text-brand-700 leading-none">{day}</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-400 mt-1">{mon}</div>
            </div>
            <div className="flex-1 border-l border-ink-100 pl-3.5 min-w-0">
              <div className="text-[15px] font-bold text-ink-900 truncate">
                {fmtTime(l.starts_at)} · {l.horse?.name ?? "—"}
              </div>
              <div className="text-[13px] text-ink-500 mt-0.5 truncate">
                with {l.trainer?.full_name ?? "—"}
              </div>
            </div>
            <span className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] px-2.5 py-1.5 rounded-full ${tag.cls}`}>
              {tag.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
