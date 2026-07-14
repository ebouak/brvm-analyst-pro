import Link from 'next/link';

/**
 * Cadenas COMPACT, pour un bloc situé dans le flux d'une page (par opposition à
 * `AccessGate`, qui remplace une page entière).
 *
 * Sécurité : ce composant est rendu À LA PLACE du bloc protégé — l'appelant ne
 * transmet aucune donnée. Le HTML envoyé au navigateur ne contient donc ni les
 * valeurs, ni le verdict. C'est un vrai verrou, pas un masque visuel.
 *
 * Le libellé du niveau vient de `feature_flags` (via canAccess), jamais du code :
 * un bloc basculé en « Gratuit » depuis /admin/features s'ouvre sans redéploiement.
 */
export function SectionLock({
  required,
  titre,
  pitch,
}: {
  required: 'premium' | 'pro' | 'disabled';
  titre: string;
  pitch: string;
}) {
  // Kill switch : proposer un abonnement serait mensonger — payer ne débloque rien.
  if (required === 'disabled') {
    return (
      <div className="rounded-panel border border-border/60 bg-surface px-5 py-6 text-center">
        <p className="text-sm text-muted">{titre} — temporairement indisponible.</p>
      </div>
    );
  }

  const label = required === 'pro' ? 'Platinium' : 'Premium';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-gold/25 bg-gold/[0.04] px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ivory">
            {titre} <span className="text-gold">— {label}</span>
          </p>
          <p className="text-xs text-muted">{pitch}</p>
        </div>
      </div>
      <Link
        href="/account/plan"
        className="shrink-0 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-[#1a1205] transition active:scale-95"
      >
        Débloquer
      </Link>
    </div>
  );
}
