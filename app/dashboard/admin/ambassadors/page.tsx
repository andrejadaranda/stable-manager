// Dashboard → Admin → Ambassadors. Owner-only.
//
// Review incoming ambassador applications (approve → creates an
// ambassador with a referral code + bronze tier; reject → marks
// rejected), and see all approved ambassadors with their tier,
// paid referrals and total commission earned.
//
// All data is read via the service-role client in services/ambassadors,
// so this page must stay owner-gated.

import { requirePageRole } from "@/lib/auth/redirects";
import {
  listApplications,
  listAmbassadors,
  eur,
  TIER_LABEL,
} from "@/services/ambassadors";
import { approveAction, rejectAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AmbassadorAdminPage() {
  await requirePageRole("owner");

  const [pending, ambassadors] = await Promise.all([
    listApplications("new"),
    listAmbassadors(),
  ]);

  const totalCommission = ambassadors.reduce(
    (sum, a) => sum + (a.total_commission_cents ?? 0),
    0,
  );
  const totalPaidReferrals = ambassadors.reduce(
    (sum, a) => sum + (a.paid_referrals ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-emerald-900">
          Ambassadors
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Review applications and manage your ambassador program.
        </p>
      </header>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Pending" value={String(pending.length)} />
        <Kpi label="Ambassadors" value={String(ambassadors.length)} />
        <Kpi label="Paid referrals" value={String(totalPaidReferrals)} />
        <Kpi label="Commission earned" value={eur(totalCommission)} />
      </div>

      {/* Pending applications */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Pending applications
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
            No pending applications right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((app) => (
              <li
                key={app.id}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-emerald-900">
                      {app.full_name}
                    </div>
                    <div className="text-sm text-stone-500">
                      {app.email}
                      {app.country ? ` · ${app.country}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveAction}>
                      <input type="hidden" name="id" value={app.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectAction}>
                      <input type="hidden" name="id" value={app.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <Detail k="Discipline" v={app.discipline} />
                  <Detail k="Horses" v={app.horses} />
                  <Detail k="Describes" v={app.describes} />
                  <Detail k="Audience" v={app.audience} />
                  <Detail k="Community" v={app.community_type} />
                  <Detail k="Community size" v={app.community_size} />
                  <Detail k="Could invite" v={app.invite_count} />
                  <Detail k="Support" v={app.support} />
                </dl>

                {(app.instagram || app.tiktok || app.facebook || app.youtube || app.other_links) && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {app.instagram && <Social label="Instagram" href={app.instagram} />}
                    {app.tiktok && <Social label="TikTok" href={app.tiktok} />}
                    {app.facebook && <Social label="Facebook" href={app.facebook} />}
                    {app.youtube && <Social label="YouTube" href={app.youtube} />}
                    {app.other_links && (
                      <span className="text-stone-500">Other: {app.other_links}</span>
                    )}
                  </div>
                )}

                {app.notes_applicant && (
                  <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
                    “{app.notes_applicant}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ambassadors */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Ambassadors
        </h2>
        {ambassadors.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
            No ambassadors yet. Approve an application to create the first one.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Ambassador</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3 text-right">Paid referrals</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {ambassadors.map((a) => (
                  <tr key={a.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-emerald-900">{a.full_name}</div>
                      <div className="text-xs text-stone-500">{a.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {a.referral_code ?? "—"}
                    </td>
                    <td className="px-4 py-3">{TIER_LABEL[a.tier] ?? a.tier}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.paid_referrals}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {eur(a.total_commission_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 font-serif text-2xl font-semibold text-emerald-900">{value}</div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-400">{k}</dt>
      <dd className="text-stone-700">{v}</dd>
    </div>
  );
}

function Social({ label, href }: { label: string; href: string }) {
  const safe = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-emerald-700 underline hover:text-emerald-900"
    >
      {label}
    </a>
  );
}
