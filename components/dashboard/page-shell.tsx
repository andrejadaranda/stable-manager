export function PageShell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h1>
      {children ?? <EmptyPlaceholder />}
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div className="card p-12 text-center">
      <p className="text-base font-semibold text-neutral-800">Coming soon</p>
      <p className="text-sm text-neutral-500 mt-1.5">
        Backend ready. UI for this page hasn&apos;t been built yet.
      </p>
    </div>
  );
}
