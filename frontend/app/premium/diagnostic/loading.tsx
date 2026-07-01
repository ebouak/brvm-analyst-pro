/**
 * Skeleton de chargement de /premium/diagnostic (calqué sur la grille réelle).
 * Affiché pendant la navigation / le server-rendering de la page.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* En-tête */}
        <div className="space-y-2">
          <div className="h-6 w-56 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-white/[0.06]" />
        </div>

        {/* Grille de cartes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-white/[0.05]" />
                </div>
                <div className="h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
