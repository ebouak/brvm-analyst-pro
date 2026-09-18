/**
 * Squelette de chargement partagé — extrait de l'ancien `app/loading.tsx`.
 *
 * POURQUOI CE COMPOSANT EXISTE. Le squelette vivait dans une frontière Suspense
 * RACINE, qui couvrait les 145 routes. Or une frontière Suspense fait diffuser
 * la réponse en flux : Next envoie les en-têtes — donc le statut **200** —
 * avant d'exécuter la page. Quand la page appelle ensuite `notFound()`, il est
 * trop tard pour corriger le statut, et une page absente répond 200 avec un
 * corps « introuvable ». Google indexe alors du vide.
 *
 * Preuve mesurée le 17/09/2026, dans les deux sens : retirer `app/loading.tsx`
 * du projet rend le 404 ; ajouter un `loading.tsx` racine à une application
 * Next 14.2.35 VIERGE casse son 404. Vingt autres pistes ont été écartées
 * auparavant — middleware, Sentry, error boundaries, cache de route,
 * `next.config.js`, layout racine, cache `.next`, arbre de dépendances.
 *
 * RÈGLE À TENIR : **aucune frontière `loading` au-dessus d'une route pouvant
 * appeler `notFound()`.** D'où des `loading.tsx` posés segment par segment,
 * uniquement là où rien en dessous n'appelle `notFound()`. Chacun se contente
 * de réexporter ce composant : le squelette reste une source unique.
 */
export default function LoadingSkeleton() {
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
