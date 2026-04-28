import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-7">
      <Link href="/" className="flex items-center gap-2.5 group">
        <span
          aria-hidden
          className="w-10 h-10 rounded-xl bg-navy-700 inline-flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 18V8.5l5-3.5 5 3.5V18M9 18v-4h2v4"
              stroke="#F4663D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className="text-[22px] text-navy-900 leading-none font-display"
          style={{ letterSpacing: "-0.015em" }}
        >
          Stable<span className="text-brand-600">.</span>OS
        </span>
      </Link>

      <div className="w-full max-w-sm card-elevated p-7 md:p-8">{children}</div>

      <p className="text-[12px] text-ink-500">
        Modern stable management. Built for the Baltics and beyond.
      </p>
    </main>
  );
}
