import Link from 'next/link';
import { LIBELLE_REGIME, TON_REGIME, fmtNervosite } from '@/lib/nervosite/affichage';
import type { BadgeNervosite as Badge } from '@/lib/nervosite/badge';

/**
 * Pastille de l'indice de nervosité : régime, valeur, séance, fraîcheur.
 * Sans hook ni état : utilisable dans un composant serveur comme dans la barre
 * de cote (client). La couleur suit le régime via les jetons du design system
 * (`TON_REGIME`, clair et sombre) ; le retard est ÉCRIT, pas seulement coloré.
 * Aucun verdict : un régime décrit l'ampleur des variations passées.
 *
 * `compacte` : régime seul (+ « retard »), pour la barre mobile. Le texte
 * complet reste dans `aria-label` et `title`.
 */
export default function BadgeNervosite({
  badge,
  compacte = false,
  className = '',
}: {
  badge: Badge;
  compacte?: boolean;
  className?: string;
}) {
  const ton = badge.regime ? TON_REGIME[badge.regime] : 'border-border bg-surface text-muted';
  const retard = badge.etat === 'en_retard';
  const date = badge.date ? `${badge.date.slice(8, 10)}/${badge.date.slice(5, 7)}` : null;

  return (
    <Link
      href="/nervosite"
      title={badge.description}
      aria-label={`${badge.description} Voir l’indice.`}
      data-etat={badge.etat}
      className={`inline-flex min-h-[28px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent-ink ${ton} ${retard ? 'border-dashed' : ''} ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {badge.regime && badge.valeur !== null ? (
        compacte ? (
          <span>{LIBELLE_REGIME[badge.regime]}</span>
        ) : (
          <span>
            <span className="font-normal opacity-80">Nervosité · </span>
            {LIBELLE_REGIME[badge.regime]}
            <span className="tabular font-normal"> · {fmtNervosite(badge.valeur)}</span>
            {date && <span className="tabular font-normal opacity-80"> · {date}</span>}
          </span>
        )
      ) : (
        <span className="font-normal">{compacte ? 'Nervosité' : 'Nervosité · indisponible'}</span>
      )}
      {retard && <span className="font-normal text-warn">· {compacte ? 'retard' : 'en retard'}</span>}
    </Link>
  );
}
