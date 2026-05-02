// Empty card shown when a user lands on a page whose feature is
// disabled in Settings → Features. Doesn't 404 — explains the state
// and links straight to the toggle.

import Link from "next/link";

export function FeatureDisabled({
  feature,
  ownerOnly = true,
  isOwner,
}: {
  feature: string;
  ownerOnly?: boolean;
  isOwner: boolean;
}) {
  return (
    <div className="card-elevated flex flex-col items-center text-center px-6 py-14">
      <span
        aria-hidden
        className="w-14 h-14 rounded-2xl bg-ink-100 inline-flex items-center justify-center mb-4"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5C6477" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0" />
        </svg>
      </span>
      <h3 className="text-base font-semibold text-ink-900">
        {feature} is turned off
      </h3>
      <p className="text-sm text-ink-500 mt-2 max-w-sm leading-relaxed">
        {isOwner
          ? "Your stable's settings have this module hidden. Switch it back on any time — your data is preserved."
          : "Your stable owner has hidden this section. Reach out if you need it back."}
      </p>
      {isOwner && ownerOnly && (
        <Link
          href="/dashboard/settings/features"
          className="
            mt-5 inline-flex items-center justify-center
            h-10 px-4 rounded-xl text-sm font-medium
            bg-brand-600 text-white shadow-sm hover:bg-brand-700
            transition-colors
          "
        >
          Open Features →
        </Link>
      )}
    </div>
  );
}
