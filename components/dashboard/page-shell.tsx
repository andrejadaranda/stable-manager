export function PageShell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ?? <EmptyPlaceholder />}
    </div>
  );
}

function EmptyPlaceholder() {
  return (
    <div className="border border-dashed border-neutral-300 rounded-lg bg-white p-10 text-center">
      <p className="text-sm font-medium text-neutral-700">Coming soon</p>
      <p className="text-xs text-neutral-500 mt-1">
        Backend ready. UI for this page hasn&apos;t been built yet.
      </p>
    </div>
  );
}
