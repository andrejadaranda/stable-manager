import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnProfile } from "@/services/account";
import { Card, CardHeader, Badge } from "@/components/ui";

export default async function SecuritySettingsPage() {
  await requirePageRole("owner", "employee", "client");
  const profile = await getOwnProfile();

  return (
    <div className="flex flex-col gap-6">
      <Card padded={false}>
        <CardHeader
          title="Account security"
          subtitle="Sign-in details and authentication methods."
        />
        <div className="p-6 flex flex-col gap-5">
          <Row label="Signed in as" value={profile.email ?? "—"} />
          <Row
            label="Authentication"
            value="Email + password"
            badge={<Badge tone="muted">Default</Badge>}
          />
          <Row label="Two-factor authentication" value="Not enabled" badge={<Badge tone="muted">Coming soon</Badge>} />
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Password"
          subtitle="Reset your password via the secure email flow."
        />
        <div className="p-6">
          <p className="text-sm text-ink-700 leading-relaxed max-w-md">
            For now, password changes are handled by the standard reset flow:
            sign out, click <strong>Forgot password</strong> on the login screen,
            and follow the link in your email. An in-app change form is coming in
            the next release.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-ink-100 last:border-0 last:pb-0 first:pt-0">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] text-ink-500 font-medium">
          {label}
        </p>
        <p className="text-sm text-ink-900 mt-1">{value}</p>
      </div>
      {badge}
    </div>
  );
}
