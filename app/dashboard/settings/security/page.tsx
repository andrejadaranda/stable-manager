import { requirePageRole } from "@/lib/auth/redirects";
import { getOwnProfile } from "@/services/account";
import { listMfaFactors } from "@/services/mfa";
import { Card, CardHeader, Badge } from "@/components/ui";
import { MfaPanel } from "@/components/settings/mfa-panel";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  await requirePageRole("owner", "employee", "client");
  const [profile, factors] = await Promise.all([
    getOwnProfile(),
    listMfaFactors().catch(() => []),
  ]);
  const verified = factors.filter((f) => f.status === "verified");
  const isMfaOn  = verified.length > 0;

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
          <Row
            label="Two-factor authentication"
            value={isMfaOn ? `Enabled · ${verified.length} authenticator${verified.length === 1 ? "" : "s"}` : "Not enabled"}
            badge={isMfaOn ? <Badge tone="success" dot>On</Badge> : <Badge tone="muted">Off</Badge>}
          />
        </div>
      </Card>

      <Card padded={false}>
        <CardHeader
          title="Two-factor authentication (2FA)"
          subtitle="Adds a 6-digit code from your phone to every sign-in. Strongly recommended for owners — your stable's books and client phone numbers are at stake."
        />
        <div className="p-6">
          <MfaPanel factors={factors} />
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
