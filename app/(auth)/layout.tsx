import Link from "next/link";
import { LinkedLogo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-7">
      <LinkedLogo size="lg" />

      <div className="w-full max-w-sm card-elevated p-7 md:p-8">{children}</div>

      <p className="text-[12px] text-ink-500">
        Modern stable management. Built for the Baltics and beyond.
      </p>
      <nav className="flex items-center gap-4 text-[11.5px] text-ink-400">
        <Link href="/legal/terms"   className="hover:text-ink-700">Terms</Link>
        <Link href="/legal/privacy" className="hover:text-ink-700">Privacy</Link>
        <Link href="/legal/cookies" className="hover:text-ink-700">Cookies</Link>
      </nav>
    </main>
  );
}
