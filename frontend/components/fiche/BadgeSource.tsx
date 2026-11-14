import type { BadgeRatio } from '@/lib/boc/ecarts';

/**
 * Badge de source d'un ratio : d'où vient le chiffre, et s'il s'écarte du
 * Bulletin officiel. Le texte porte l'information (jamais la couleur seule) ;
 * le détail est lisible au survol et par les lecteurs d'écran.
 */
const TON: Record<BadgeRatio['source'], string> = {
  calcule: 'border-border text-muted',
  boc: 'border-accent/40 text-accent-ink',
  ns: 'border-border text-faint',
  manquant: 'border-border text-faint',
};

export default function BadgeSource({ badge }: { badge: BadgeRatio }) {
  const ton = badge.ecart ? 'border-warn/50 text-warn' : TON[badge.source];
  return (
    <span
      title={badge.detail}
      className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-medium leading-4 ${ton}`}
    >
      {badge.ecart ? `${badge.libelle} · écart BOC` : badge.libelle}
      <span className="sr-only"> — {badge.detail}</span>
    </span>
  );
}
