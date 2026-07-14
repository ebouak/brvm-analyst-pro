import Link from 'next/link';

/**
 * Voile premium sur une section.
 *
 * Principe demandé : ne PAS cacher la section pour un compte gratuit, mais
 * signaler sa présence pour donner envie de s'abonner.
 *
 * ── Sécurité : vrai verrou, pas seulement du flou ──
 * Ce composant N'AFFICHE AUCUNE donnée réelle. Il dessine un SQUELETTE FACTICE
 * (barres grises), flouté, sous le voile. La donnée premium ne doit donc pas être
 * chargée par l'appelant pour un compte gratuit : le HTML envoyé au navigateur ne
 * la contient pas, et l'inspecteur ne révèle rien. C'est ce qui distingue ce
 * verrou d'un simple `blur()` cosmétique — sur lequel les vrais signaux seraient
 * lisibles dans le code source.
 *
 * `rows` ajuste la hauteur du faux aperçu à la section masquée.
 */
export function PremiumLock({
  title,
  pitch,
  rows = 3,
}: {
  title: string;
  pitch: string;
  rows?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gold/25 bg-surface">
      {/* Squelette DÉCORATIF — aucune donnée réelle. */}
      <div aria-hidden className="pointer-events-none select-none space-y-2 p-4 blur-[3px]">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-elevated" />
          <div className="h-4 w-12 rounded bg-elevated" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-elevated/50 p-2.5">
            <div className="h-3 w-24 rounded bg-elevated" />
            <div className="h-3 w-10 rounded bg-elevated" />
          </div>
        ))}
      </div>

      {/* Voile + appel à l'abonnement. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/70 px-6 text-center backdrop-blur-[2px]">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-ivory">{title}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted">{pitch}</p>
        </div>
        <Link
          href="/account/plan"
          className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-[#1a1205] transition active:scale-95"
        >
          Passer à Premium
        </Link>
      </div>
    </div>
  );
}
