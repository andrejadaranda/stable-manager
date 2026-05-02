import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnStable } from "@/services/stables";
import { Card, CardHeader, Field, Input, Button } from "@/components/ui";
import { updateStableNameAction } from "../actions";
import { ExportPanel } from "@/components/settings/export-panel";

export default async function StableSettingsPage() {
  await requirePageRole("owner");
  const stable = await getOwnStable();

  return (
    <div className="flex flex-col gap-6">
      <Card padded={false}>
        <CardHeader
          title="Stable details"
          subtitle="Public name shown to clients on invoices and the portal."
        />
        <form action={updateStableNameAction} className="p-6 flex flex-col gap-5">
          <Field
            label="Stable name"
            required
            hint="Up to 80 characters."
          >
            <Input
              name="name"
              defaultValue={stable.name}
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Riverside Stables"
            />
          </Field>

          <Field label="Stable handle" hint="Used internally for URLs. Cannot be changed yet.">
            <Input
              name="slug"
              defaultValue={stable.slug}
              disabled
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Public page"
          subtitle="Share this link with prospective clients on Instagram, WhatsApp, or printed flyers. Read-only — no internal data is exposed."
        />
        <div className="p-6 flex flex-col gap-3">
          <code className="bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-sm tabular-nums break-all">
            /s/{stable.slug}
          </code>
          <a
            href={`/s/${stable.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="
              self-start h-9 px-3 rounded-lg text-[12.5px] font-medium
              text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1.5
            "
          >
            Open in new tab →
          </a>
          <p className="text-[12px] text-ink-500 leading-relaxed">
            Horses appear once you add a public bio to them in their profile.
            Services appear automatically from your price list.
          </p>
        </div>
      </Card>

      <ExportPanel />

      <Card padded={false}>
        <CardHeader
          title="Danger zone"
          subtitle="Irreversible actions. Reach out before deleting data."
        />
        <div className="p-6 text-sm text-ink-500">
          Stable deletion will appear here once the cancellation flow ships.
        </div>
      </Card>
    </div>
  );
}
