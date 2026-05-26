import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnStable } from "@/services/stables";
import { Card, CardHeader, Field, Input, Button } from "@/components/ui";
import {
  updateStableNameAction,
  toggleAcceptsPublicJoinAction,
} from "../actions";
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

      {/* BUG #GG fix — Public page panel removed until the /s/[handle]
          route is built. Previously advertised /s/{slug} as a shareable
          link, but both app.longrein.eu and longrein.eu returned 404.
          Restore this panel once the marketing-side stable profile ships. */}

      <Card padded={false}>
        <CardHeader
          title="Public sign-ups"
          subtitle="Anyone with your join link can apply as a rider or horse owner. You approve each application before they get app access."
        />
        <div className="p-6 flex flex-col gap-4">
          <div className="rounded-xl bg-ink-50/60 px-4 py-3 text-[12.5px] text-ink-700">
            <p>
              Join link:{" "}
              <span className="font-mono text-navy-900 break-all">
                https://app.longrein.eu/signup/join/{stable.slug}
              </span>
            </p>
            <p className="mt-1 text-ink-500">
              Share on Instagram bio, WhatsApp, printed flyers, your website
              footer.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-navy-900">
                {stable.accepts_public_join
                  ? "Accepting public applications"
                  : "Public applications turned off"}
              </p>
              <p className="text-[12px] text-ink-500 mt-1 max-w-md">
                {stable.accepts_public_join
                  ? "New applicants land in Join requests for your review."
                  : "The join link returns a friendly “not accepting right now” message — you can still invite people manually from Clients."}
              </p>
            </div>
            <form action={toggleAcceptsPublicJoinAction}>
              <input
                type="hidden"
                name="enabled"
                value={stable.accepts_public_join ? "false" : "true"}
              />
              <Button
                type="submit"
                variant={stable.accepts_public_join ? "secondary" : "primary"}
              >
                {stable.accepts_public_join ? "Turn off" : "Turn on"}
              </Button>
            </form>
          </div>
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
