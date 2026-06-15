export function AdminPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ivory">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6 rounded-xl border border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted">Module en cours de construction.</p>
        <p className="mt-1 text-xs text-faint">Disponible dans un prochain lot.</p>
      </div>
    </div>
  );
}
