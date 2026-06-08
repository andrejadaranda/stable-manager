import { requirePageRole } from "@/lib/auth/redirects";
import { getStableIssuer, isIssuerReady } from "@/services/stableIssuer";
import { IssuerForm } from "@/components/settings/issuer-form";

export default async function IssuerSettingsPage() {
  await requirePageRole("owner");
  const issuer = await getStableIssuer();
  const ready  = isIssuerReady(issuer);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Issuer details
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Required on every invoice. Without these your generated documents
          are internal receipts, not valid VAT invoices.
        </p>
      </div>

      {!ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-[13px]">
          <strong>Incomplete.</strong> Fill in legal name, business code, and
          address to enable bulk invoice generation.
        </div>
      )}

      <IssuerForm initial={issuer} />
    </div>
  );
}
