// /legal landing — index of the three legal pages.

import Link from "next/link";

export const metadata = {
  title: "Legal · Longrein",
  description: "Terms of Service, Privacy Policy, and Cookie Policy for Longrein.",
};

const PAGES = [
  {
    href:        "/legal/terms",
    title:       "Terms of Service",
    description: "How Longrein and your stable agree to work together.",
  },
  {
    href:        "/legal/privacy",
    title:       "Privacy Policy",
    description: "What personal data we collect, why, and how to ask for it back.",
  },
  {
    href:        "/legal/cookies",
    title:       "Cookie Policy",
    description: "Which cookies we use, what each does, and how to opt out.",
  },
];

export default function LegalIndexPage() {
  return (
    <>
      <h1 className="font-display text-3xl md:text-4xl text-navy-900 leading-tight mb-3">
        Legal
      </h1>
      <p className="text-ink-600 text-base mb-8">
        The contracts and policies that cover your use of Longrein.
        Plain language where we can; legal precision where we must.
        Last updated: 2026-05-02.
      </p>

      <ul className="not-prose flex flex-col gap-3">
        {PAGES.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="block bg-white rounded-2xl shadow-soft hover:shadow-lift transition-shadow p-5"
            >
              <p className="font-semibold text-navy-900">{p.title}</p>
              <p className="text-[13px] text-ink-500 mt-1">{p.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
