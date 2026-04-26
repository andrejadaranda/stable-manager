export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white shadow-sm border border-neutral-200 rounded-xl p-6">
        {children}
      </div>
    </main>
  );
}
