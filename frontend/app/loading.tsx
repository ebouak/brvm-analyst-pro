/**
 * Loading global (boundary Suspense racine) : s'affiche INSTANTANÉMENT au clic
 * pour toute route sans loading.tsx propre. Sans lui, une navigation vers une
 * page dynamique (session dans le layout → tout est SSR) ne donne AUCUN retour
 * visuel pendant le rendu serveur → clics perçus comme morts.
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] p-6 space-y-4" aria-busy="true" aria-label="Chargement">
      {/* Barre de progression indéterminée en haut de zone */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
        <div className="h-full w-1/3 animate-[loading-slide_1.1s_ease-in-out_infinite] rounded-full bg-gold/70" />
      </div>
      <div className="h-8 w-56 bg-surface border border-border rounded-xl animate-pulse" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
