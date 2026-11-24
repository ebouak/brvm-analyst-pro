import type { Badge } from '@/lib/academy/nouveaute';

/**
 * Pastille « Nouveau » / « Mis à jour » sur les surfaces sombres de l'Academy
 * (sommaire, aperçu, page d'accueil). Sur la page claire d'une leçon, c'est
 * `.lp-nouveaute` (lecon.css) qui s'en charge.
 */
export default function BadgeNouveaute({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
        badge.type === 'nouveau' ? 'bg-up/15 text-up' : 'bg-accent/15 text-accent'
      }`}
    >
      {badge.libelle}
    </span>
  );
}
