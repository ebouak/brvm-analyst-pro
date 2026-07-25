import type { Fraicheur } from '@/lib/freshness';

/**
 * Badge de fraîcheur des cours. Non premium : la fraîcheur est un argument de
 * confiance, pas un produit. L'état 'inconnu' est affiché, jamais masqué.
 */

const STYLE: Record<Fraicheur['etat'], { point: string; texte: string }> = {
  frais:   { point: 'bg-up',    texte: 'text-up' },
  recent:  { point: 'bg-muted', texte: 'text-muted' },
  perime:  { point: 'bg-down',  texte: 'text-down' },
  inconnu: { point: 'bg-faint', texte: 'text-faint' },
};

function ageTexte(f: Fraicheur): string {
  if (f.etat === 'inconnu' || f.ageMinutes == null) return 'Fraîcheur inconnue';
  if (f.etat === 'perime') {
    const h = Math.floor(f.ageMinutes / 60);
    return h >= 1 ? `Données figées depuis ${h} h` : 'Collecte interrompue';
  }
  if (f.ageMinutes < 60) return `À jour · il y a ${Math.max(1, f.ageMinutes)} min`;
  const h = Math.floor(f.ageMinutes / 60);
  if (h < 24) return `À jour · il y a ${h} h`;
  return `Dernière séance : ${f.derniereSeance ?? '—'}`;
}

export default function FreshnessBadge({ fraicheur }: { fraicheur: Fraicheur }) {
  const s = STYLE[fraicheur.etat];
  const titre = [
    fraicheur.derniereSeance ? `Dernière séance : ${fraicheur.derniereSeance}` : null,
    fraicheur.derniereCollecte ? `Dernière collecte : ${new Date(fraicheur.derniereCollecte).toLocaleString('fr-FR')}` : null,
  ].filter(Boolean).join('\n');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${s.texte}`}
      title={titre || 'Fraîcheur des cours'}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.point}`} aria-hidden />
      {ageTexte(fraicheur)}
    </span>
  );
}
