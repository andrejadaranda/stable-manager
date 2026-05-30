// Brand kit settings — logo + color picker. Owner-only.

import { requirePageRole } from "@/lib/auth/redirects";
import { getBrandKit } from "@/services/brandKit";
import { BrandKitForm } from "@/components/settings/brand-kit-form";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  await requirePageRole("owner");
  const brand = await getBrandKit();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-xl text-navy-700">Brand kit</h2>
        <p className="text-sm text-ink-500 mt-1.5">
          Your logo and accent color show up in client invitation emails and the app header.
          Riders see <strong>your brand</strong> first — not Longrein.
        </p>
      </header>
      <BrandKitForm
        initialColor={brand.brand_color}
        initialLogoUrl={brand.logo_url}
        stableName={brand.stable_name}
      />
    </div>
  );
}
