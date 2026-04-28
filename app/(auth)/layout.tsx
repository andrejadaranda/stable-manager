import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <Link href="/" className="flex items-center gap-2">
        <span
          aria-hidden
          className="w-9 h-9 rounded-xl bg-brand-600 inline-flex items-center justify-center shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 18V8.5l5-3.5 5 3.5V18M9 18v-4h2v4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-lg font-semibold text-ink-900 tracking-tightest">
          Stable OS
        </span>
      </Link>

      <div className="w-full max-w-sm card-elevated p-7 md:p-8">{children}</div>

      <p className="text-[12px] text-ink-500">
        Built for European riding stables.
      </p>
    </main>
  );
}
