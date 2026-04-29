import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getClient, type SkillLevel } from "@/services/clients";
import { getClientLessons, type ClientLessonRow } from "@/services/lessons";
import { getClientBalance } from "@/services/payments";
import { listClientPackages } from "@/services/packages";
import { listChargesForClient } from "@/services/boarding";
import { listClientAgreements } from "@/services/agreements";
import { fmtDayLabel, fmtTime } from "@/lib/utils/dates";
import { EditClientButton } from "@/components/clients/edit-client-dialog";
import { PackagePanel } from "@/components/clients/package-panel";
import { ClientBoardingSection } from "@/components/clients/client-boarding-section";
import { AgreementsPanel } from "@/components/clients/agreements-panel";

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

  const [upcoming, recent, packages, boardingCharges, agreements] = await Promise.all([
    getClientLessons(params.id, { direction: "upcoming", limit: 10 }),
    getClientLessons(params.id, { direction: "recent",   limit: 10 }),
    listClientPackages(params.id),
    listChargesForClient(params.id),
    listClientAgreements(params.id),
  ]);

  // Owner-only: payment balance. Service throws FORBIDDEN for employees,
  // so we just don't call it for them.
  let balance: number | null = null;
  if (session.role === "owner") {
    balance = await getClientBalance(params.id);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/dashboard/clients"
        className="text-sm text-neutral-600 hover:underline w-fit"
      >
        ← Clients
      </Link>

      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{client.full_name}</h1>
          <span
            className={`text-sm ${
              client.active ? "text-emerald-700" : "text-neutral-500"
            }`}
          >
            {client.active ? "Active" : "Inactive"}
          </span>
        </div>
        <EditClientButton client={client} />
      </header>

      <section className="border border-neutral-200 rounded-md bg-white p-4 grid grid-cols-2 gap-3 text-sm">
        <Field label="Phone" value={client.phone} />
        <Field label="Email" value={client.email} />
        <Field
          label="Skill level"
          value={client.skill_level ? SKILL_LABEL[client.skill_level] : null}
        />
      </section>

      {session.role === "owner" && (
        <section className="border border-neutral-200 rounded-md bg-white p-4">
          <h2 className="text-sm font-medium mb-1">Balance</h2>
          <BalanceLine balance={balance} />
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
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-neutral-800">{value ?? "—"}</p>
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
          className="px-4 py-2 text-sm grid grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-center"
        >
          <div className="text-neutral-700">
            {fmtDayLabel(new Date(l.starts_at))} · {fmtTime(l.starts_at)}
          </div>
          <div>{l.horse?.name ?? "—"}</div>
          <div className="text-neutral-600">
            {l.trainer?.full_name ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            {l.status.replace("_", " ")}
          </div>
        </div>
      ))}
    </div>
  );
}
