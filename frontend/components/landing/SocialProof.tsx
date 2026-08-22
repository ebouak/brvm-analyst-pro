/**
 * Orphelin depuis 697e2e4 : la landing rend désormais une carte compacte
 * équivalente dans sa rangée « Communauté / Premium / Brief » (3 colonnes),
 * qui reprend les mêmes chiffres et les mêmes sources. Conservé, non
 * supprimé — ne pas réutiliser sans vérifier que ce choix tient toujours.
 *
 * Preuve sociale — HONNÊTE :
 * - Compteur = communauté réelle (~2 000 membres), framé comme « communauté »
 *   (pas comme « inscrits sur la plateforme »). Aucun chiffre inventé.
 * - Bande « sources officielles » : logo BRVM réel + labels texte des sources
 *   effectivement utilisées (pas de faux logos).
 */

const SOURCES = ['BDFIN', 'BCEAO', 'BloomField', 'GitHub brvm-data-public'];

export function SocialProof() {
  return (
    <section aria-label="Preuve sociale et sources de données" className="mt-4 space-y-3">
      {/* Communauté */}
      <div className="flex flex-col items-center gap-1 rounded-panel border border-white/10 bg-white/[0.02] px-5 py-4 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
          </span>
          <span className="font-display text-2xl font-semibold text-accent tabular">2 000+</span>
        </span>
        <span className="text-sm text-muted">
          membres dans la communauté WESTBOURSE suivent la BRVM avec des données
        </span>
      </div>

      {/* Sources officielles */}
      <div className="rounded-panel border border-white/10 bg-white/[0.02] px-5 py-4">
        <p className="mb-3 text-center text-[10px] uppercase tracking-[0.18em] text-faint">
          Données vérifiées · sources officielles
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/brvm-logo.png"
            alt="BRVM"
            className="h-6 w-auto opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
          />
          {SOURCES.map((s) => (
            <span
              key={s}
              className="font-mono text-[12px] font-medium text-muted/70 transition-colors duration-300 hover:text-ivory"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
