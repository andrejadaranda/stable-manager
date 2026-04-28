import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnStable } from "@/services/stables";
import { Card, CardHeader, Field, Input, Button } from "@/components/ui";
import { updateStableNameAction } from "../actions";

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
              placeholder="e.g. Pajurio Žirgynas"
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
          title="Danger zone"
          subtitle="Irreversible actions. Reach out before deleting data."
        />
        <div className="p-6 text-sm text-ink-500">
          Stable deletion and data export will appear here in a future release.
        </div>
      </Card>
    </div>
  );
}
