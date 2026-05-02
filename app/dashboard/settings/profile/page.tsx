// Settings → Profile. The owner's / employee's / client's own
// account-level details: name, photo, phone, role badge.
//
// The avatar in the sidebar pulls from `profiles.photo_url`, so
// changing the URL here updates everywhere immediately after save
// (action revalidates the dashboard layout).

import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnProfile } from "@/services/account";
import { Card, CardHeader, Field, Input, Button, Badge } from "@/components/ui";
import { updateProfileNameAction } from "../actions";

const ROLE_LABEL: Record<"owner" | "employee" | "client", string> = {
  owner: "Owner",
  employee: "Employee",
  client: "Client",
};

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  await requirePageRole("owner", "employee", "client");
  const profile = await getOwnProfile();
  const initial = (profile.full_name ?? profile.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-6">
      <Card padded={false}>
        <CardHeader
          title="Profile"
          subtitle="Your name + photo + phone appear in the sidebar, on lessons, payments, and any invitations you send."
        />
        <form action={updateProfileNameAction} className="p-6 flex flex-col gap-5">
          {/* Avatar preview + photo URL — clicking the photo isn't a
              real upload yet (Supabase Storage ships next wave). For
              now any public image URL works (Cloudinary / Imgur / etc.) */}
          <div className="flex items-center gap-4">
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photo_url}
                alt={profile.full_name ?? "Profile photo"}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white shadow-soft"
              />
            ) : (
              <span
                aria-hidden
                className="w-16 h-16 rounded-2xl shrink-0 inline-flex items-center justify-center bg-brand-500 text-white font-semibold text-2xl shadow-soft"
              >
                {initial}
              </span>
            )}
            <div className="text-[12px] text-ink-500 leading-relaxed">
              <p>
                Paste a public image URL below — it will replace the initial
                avatar in the sidebar.
              </p>
              <p className="mt-0.5">
                Direct upload from your phone is shipping soon.
              </p>
            </div>
          </div>

          <Field label="Photo URL (optional)" hint="Public image URL — Imgur, Cloudinary, your own host.">
            <Input
              name="photo_url"
              type="url"
              defaultValue={profile.photo_url ?? ""}
              placeholder="https://…"
              maxLength={500}
            />
          </Field>

          <Field label="Full name" required>
            <Input
              name="full_name"
              defaultValue={profile.full_name ?? ""}
              required
              maxLength={80}
              placeholder="e.g. Andreja Adaranda"
            />
          </Field>

          <Field label="Phone (optional)" hint="Used for staff coordination — not visible to clients.">
            <Input
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ""}
              maxLength={32}
              placeholder="+370 6…"
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
