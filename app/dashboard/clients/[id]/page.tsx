import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getClient, type SkillLevel } from "@/services/clients";
import { getClientLessons, type ClientLessonRow } from "@/services/lessons";
import { getClientBalance } from "@/services/payments";
import { listClientPackages } from "@/services/packages";
import { listChargesForClient } from "@/services/boarding";
import { listClientAgreements } from "@/services/agreements";
import { listClientCharges } from "@/services/clientCharges";
import { fmtDayLabel, fmtTime } from "@/lib/utils/dates";
import { EditClientButton } from "@/components/clients/edit-client-dialog";
import { PackagePanel } from "@/components/clients/package-panel";
import { ClientBoardingSection } from "@/components/clients/client-boarding-section";
import { AgreementsPanel } from "@/components/clients/agreements-panel";
import { ChargesPanel } from "@/components/clients/charges-panel";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Owner + employee may view the page. Balance is gated below.
  const session = await requirePageRole("owner", "employee");

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

  // Owner-only: payment balance. Service throws FORBIDDEN for employees,
  // so we just don't call it for them.
  let balance: number | null = null;
  if (session.role === "owner") {
    balance = await getClientBalance(params.id);
  }

  const initial = client.full_name?.[0]?.toUpperCase() ?? "?";

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
        <div
          className="h-24 md:h-28 w-full"
          style={{
            background:
              "linear-gradient(135deg, #1E2A47 0%, #2F406A 50%, #5C6B92 100%)",
          }}
          aria-hidden
        />
        <div className="px-5 md:px-7 pb-5 -mt-10 md:-mt-12">
          <div className="flex flex-col md:flex-row md:items-end md:gap-5">
            <div
              className="self-center md:self-end shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl ring-4 ring-white shadow-soft inline-flex items-center justify-center"
              style={{ background: "#F4663D" }}
              aria-hidden
            >
              <span className="text-white text-3xl font-semibold">{initial}</span>
            </div>
            <div className="flex-1 min-w-0 mt-3 md:mt-0 md:pb-1 text-center md:text-left">
              <h1
                className="text-2xl md:text-[28px] leading-none text-ink-900 truncate"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500, letterSpacing: "-0.01em" }}
              >
                {client.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 justify-center md:justify-start">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full ${
                    client.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-ink-100 text-ink-700"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${client.active ? "bg-emerald-500" : "bg-ink-400"}`} />
                  {client.active ? "Active" : "Inactive"}
                </span>
                {client.skill_level && (
                  <span className="text-[11.5px] text-ink-700 px-2 py-0.5 rounded-md bg-ink-100">
                    {SKILL_LABEL[client.skill_level]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-center md:self-end mt-3 md:mt-0 md:pb-1">
              <EditClientButton client={client} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
            <ContactTile label="Phone" value={client.phone} />
            <ContactTile label="Email" value={client.email} />
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

      {session.role === "owner" && (
        <section className="bg-white rounded-2xl shadow-soft p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
              Balance
            </h2>
            <div className="mt-2">
              <BalanceLine balance={balance} />
            </div>
          </div>
          <Link
            href={`/dashboard/clients/${client.id}/invoice`}
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
            Print invoice
          </Link>
        </section>
      )}

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

      {client.notes && (
        <section className="border border-neutral-200 rounded-md bg-white p-4">
          <h2 className="text-sm font-medium mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap text-neutral-800">
            {client.notes}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Upcoming lessons</h2>
        <LessonList lessons={upcoming} empty="No upcoming lessons." />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Recent lessons</h2>
        <LessonList lessons={recent} empty="No past lessons yet." />
      </section>
    </div>
  );
}

// ---------- helpers ----------
function ContactTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-ink-50/60 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-500">{label}</p>
      <p className="text-sm text-ink-900 mt-1 truncate">{value ?? <span className="text-ink-400">—</span>}</p>
    </div>
  );
}

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
    return <p className="text-sm text-neutral-500">{empty}</p>;
  }
  return (
    <div className="border border-neutral-200 rounded-md bg-white divide-y divide-neutral-200">
      {lessons.map((l) => (
        <div
          key={l.id}
          className="
            px-4 py-2.5 text-sm
            sm:grid sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:gap-3 sm:items-center
          "
        >
          <div className="text-neutral-700">
            {fmtDayLabel(new Date(l.starts_at))} · {fmtTime(l.starts_at)}
          </div>
          <div className="text-neutral-700 sm:text-inherit">
            {l.horse?.name ?? "—"}
            <span className="text-neutral-400 sm:hidden"> · </span>
            <span className="sm:hidden text-neutral-600">
              {l.trainer?.full_name ?? "—"}
            </span>
          </div>
          <div className="hidden sm:block text-neutral-600">
            {l.trainer?.full_name ?? "—"}
          </div>
          <div className="mt-0.5 sm:mt-0 text-[10px] uppercase tracking-wider text-neutral-500">
            {l.status.replace("_", " ")}
          </div>
        </div>
      ))}
    </div>
  );
}
