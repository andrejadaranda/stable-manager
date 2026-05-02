// /s/[slug] — public stable page. Read-only marketing surface that an
// owner can share on Instagram, WhatsApp, or a printed flyer. No
// auth required.
//
// What's shown:
//   • Hero: stable name (serif, large) + tagline.
//   • Services: full price list with durations.
//   • Horses: only those with a public_bio set, in a card grid with
//     photos + bios.
//
// What's NOT shown (privacy by default):
//   • Clients, payments, schedules, internal notes, daily limits.
//
// "Powered by Hoofbeat" footer with a subtle wait-list CTA — every
// visitor is a potential trial conversion.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicStable } from "@/services/publicStable";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const dynamic = "force-dynamic";
export const revalidate = 60; // cache 60s — public page can be slightly stale

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getPublicStable(params.slug);
  if (!data.stable) return { title: "Stable not found" };
  return {
    title:       `${data.stable.name} · Hoofbeat`,
    description: `See ${data.stable.name}'s lessons, horses, and price list.`,
    openGraph: {
      title:       data.stable.name,
      description: `Lessons + horses at ${data.stable.name}. Powered by Hoofbeat.`,
      type:        "website",
    },
  };
}

export default async function PublicStablePage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getPublicStable(params.slug);
  if (!data.stable) notFound();

  const { stable, horses, services } = data;

  return (
    <main className="min-h-screen bg-surface">
      {/* Hero ---------------------------------------------------------- */}
      <header
        className="relative px-5 py-12 md:py-20 text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1E3A2A 0%, #2D5440 50%, #5C7C5F 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)",
            backgroundSize: "44px 44px, 38px 38px",
          }}
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/70">
            Riding stable
          </p>
          <h1
            className="text-5xl md:text-7xl mt-3 leading-none"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {stable.name}
            <span className="text-brand-300">.</span>
          </h1>
          <p className="text-base text-white/80 mt-5 max-w-xl leading-relaxed">
            Lessons, livery, and horse care done with attention.
          </p>
        </div>
      </header>

      {/* Body ---------------------------------------------------------- */}
      <div className="max-w-4xl mx-auto px-5 py-12 md:py-16 flex flex-col gap-12">

        {/* Services */}
        {services.length > 0 && (
          <section>
            <h2
              className="text-2xl md:text-3xl text-navy-900 leading-none mb-6"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
            >
              Lessons & services
            </h2>
            <ul className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y divide-ink-100">
              {services.map((s) => (
                <li key={s.id} className="px-5 py-4 flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-900">{s.name}</p>
                    {s.description && (
                      <p className="text-[12.5px] text-ink-500 mt-1">{s.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-navy-900 tabular-nums">
                      {FMT_EUR.format(Number(s.base_price))}
                    </p>
                    <p className="text-[11px] text-ink-500 tabular-nums">
                      {s.default_duration_minutes} min
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Horses */}
        {horses.length > 0 && (
          <section>
            <h2
              className="text-2xl md:text-3xl text-navy-900 leading-none mb-6"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
            >
              Meet the horses
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {horses.map((h) => (
                <li key={h.id} className="bg-white rounded-2xl shadow-soft overflow-hidden">
                  {h.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.photo_url}
                      alt={h.name}
                      className="w-full h-44 object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-44 flex items-center justify-center"
                      style={{ background: "#F5DDCB" }}
                      aria-hidden
                    >
                      <span
                        className="text-5xl text-brand-700"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {h.name[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                  )}
                  <div className="px-4 py-3">
                    <p
                      className="text-lg text-navy-900 leading-tight"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
                    >
                      {h.name}
                    </p>
                    {h.breed && (
                      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-500 mt-0.5">
                        {h.breed}
                      </p>
                    )}
                    {h.public_bio && (
                      <p className="text-[12.5px] text-ink-700 mt-2 leading-relaxed">
                        {h.public_bio}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {services.length === 0 && horses.length === 0 && (
          <section className="bg-white rounded-2xl shadow-soft px-6 py-16 text-center">
            <p
              className="text-2xl text-navy-900 leading-none mb-2"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Coming soon.
            </p>
            <p className="text-sm text-ink-500 max-w-sm mx-auto">
              {stable.name} is setting up. Check back soon for lessons and horses.
            </p>
          </section>
        )}
      </div>

      {/* Footer -------------------------------------------------------- */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="max-w-4xl mx-auto px-5 py-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11.5px] text-ink-500">
            © {new Date().getFullYear()} {stable.name}
          </p>
          <Link
            href="/"
            className="text-[11.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5"
          >
            Powered by <span className="font-semibold text-navy-900">Hoofbeat<span className="text-brand-600">.</span></span>
          </Link>
        </div>
      </footer>
    </main>
  );
}
