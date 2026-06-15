export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-xs text-white/40">Dernière mise à jour : {updatedAt}</p>
        <div className="legal-prose mt-8 space-y-6 text-sm leading-relaxed text-white/70">
          {children}
        </div>
      </article>
    </main>
  );
}
