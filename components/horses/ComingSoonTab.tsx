// Placeholder for tabs that aren't built yet (Health, Goals, Media in
// Phase 1). Used instead of disabling the tab so the design still
// communicates the full IA.

export function ComingSoonTab({
  title,
  body,
  availability,
}: {
  title: string;
  body: string;
  availability: string;
}) {
  return (
    <section className="card-elevated p-8 md:p-10 text-center">
      <span className="inline-block text-[10.5px] tracking-[0.04em] uppercase text-ink-500 mb-3">
        {availability}
      </span>
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="text-sm text-ink-500 mt-2 max-w-sm mx-auto leading-relaxed">{body}</p>
    </section>
  );
}
