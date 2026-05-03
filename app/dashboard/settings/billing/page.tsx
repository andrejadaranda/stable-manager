import { requirePageRole } from "@/lib/auth/redirects";
import { Card, CardHeader, Badge } from "@/components/ui";

export default async function BillingSettingsPage() {
  await requirePageRole("owner");

  return (
    <div className="flex flex-col gap-6">
      <Card padded={false}>
        <CardHeader
          title="Plan"
          subtitle="Your current subscription tier and limits."
          action={<Badge tone="success" dot>Free preview</Badge>}
        />
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-ink-700 leading-relaxed">
            You're using Longrein during the early preview. Billing isn't
            enabled yet — once paid plans launch, your stable will keep
            working and you'll have a chance to choose a plan.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            <PlanTile name="Starter" price="€19/mo" body="10 horses · 30 clients · 1 trainer" />
            <PlanTile name="Pro" price="€49/mo" body="40 horses · 200 clients · 5 trainers · workload alerts" highlight />
            <PlanTile name="Premium" price="€99/mo" body="Unlimited · multi-location · white-label" />
          </ul>
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader title="Invoices" subtitle="Billing history will appear here." />
        <div className="p-6 text-sm text-ink-500">No invoices yet.</div>
      </Card>
    </div>
  );
}

function PlanTile({
  name,
  price,
  body,
  highlight,
}: {
  name: string;
  price: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <li
      className={
        "rounded-xl border p-4 " +
        (highlight
          ? "border-brand-200 bg-brand-50/40"
          : "border-ink-200 bg-white")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">{name}</p>
        {highlight && <Badge tone="brand">Most popular</Badge>}
      </div>
      <p className="text-base font-semibold text-ink-900 mt-1.5 tracking-tightest">
        {price}
      </p>
      <p className="text-[12px] text-ink-500 mt-1.5 leading-relaxed">{body}</p>
    </li>
  );
}
