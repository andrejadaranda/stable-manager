// Legal pages (Terms / Privacy / Cookies) — public, no auth required.
// Brand-styled (Paddock + Cream). Footer back-link to home.

import Link from "next/link";
import { LinkedLogo } from "@/components/brand/logo";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-ink-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <LinkedLogo size="md" />
          <nav className="flex items-center gap-5 text-[13px] text-ink-600">
            <Link href="/legal/terms"   className="hover:text-ink-900">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-ink-900">Privacy</Link>
            <Link href="/legal/cookies" className="hover:text-ink-900">Cookies</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 md:py-14">
        <article className="prose prose-sm md:prose-base max-w-none text-ink-800 leading-relaxed">
          {children}
        </article>
      </main>

      <footer className="border-t border-ink-100 bg-white/40">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between text-[12px] text-ink-500">
          <span>© 2026 Longrein · Vilnius, Lithuania</span>
          <Link href="/" className="hover:text-ink-900">Back to home →</Link>
        </div>
      </footer>
    </div>
  );
}
