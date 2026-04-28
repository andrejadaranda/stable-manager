import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnProfile } from "@/services/account";
import { Card, CardHeader, Field, Input, Button, Badge } from "@/components/ui";
import { updateProfileNameAction } from "../actions";

const ROLE_LABEL: Record<"owner" | "employee" | "client", string> = {
  owner: "Owner",
  employee: "Employee",
  client: "Client",
};

export default async function ProfileSettingsPage() {
  await requirePageRole("owner", "employee", "client");
  const profile = await getOwnProfile();

  return (
    <div className="flex flex-col gap-6">
      <Card padded={false}>
        <CardHeader
          title="Profile"
          subtitle="Your name appears on lessons, payments, and invitations."
        />
        <form action={updateProfileNameAction} className="p-6 flex flex-col gap-5">
          <Field label="Full name" required>
            <Input
              name="full_name"
              defaultValue={profile.full_name ?? ""}
              required
              maxLength={80}
              placeholder="Jonas Petraitis"
            />
          </Field>

          <Field label="Email" hint="Email cannot be changed here yet — contact support.">
            <Input
              type="email"
              defaultValue={profile.email ?? ""}
              disabled
            />
          </Field>

          <Field label="Role">
            <div>
              <Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge>
            </div>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
