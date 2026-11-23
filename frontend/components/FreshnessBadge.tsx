'use client';

import { computeFreshness, estEnSeance, type Fraicheur } from '@/lib/freshness';
import { phraseReleve } from '@/lib/realtime/releve';
import { useMaintenant, useReleve } from '@/lib/realtime/useReleve';

/**
 * Badge de fraîcheur des cours. Non premium : la fraîcheur est un argument de
 * confiance, pas un produit. L'état 'inconnu' est affiché, jamais masqué.
 *
 * Composant CLIENT depuis le 2026-11-23 : calculé au rendu, il restait sur
 * « il y a 13 min » juste après un nouveau relevé. Il part de l'état calculé
 * par le serveur (même texte au premier rendu, pas d'écart d'hydratation), puis
 * suit l'horloge et l'heure du relevé partagée avec « En direct » (useReleve).
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
  const { releve, echanges } = useReleve();
  const maintenant = useMaintenant();

  let f = fraicheur;
  let texte = ageTexte(fraicheur);
  if (maintenant) {
    // Le relevé reçu en direct, s'il est plus récent que la collecte lue au rendu.
    const collecte = releve != null && (fraicheur.derniereCollecte == null || releve > Date.parse(fraicheur.derniereCollecte))
      ? new Date(releve).toISOString()
      : fraicheur.derniereCollecte;
    f = computeFreshness(collecte, fraicheur.derniereSeance, maintenant);
    const duJour = collecte != null && new Date(collecte).toISOString().slice(0, 10) === maintenant.toISOString().slice(0, 10);
    texte = estEnSeance(maintenant) && duJour && f.etat !== 'perime' && f.etat !== 'inconnu'
      ? phraseReleve({ dernier: new Date(collecte!), maintenant, echanges })
      : ageTexte(f);
  }

  const s = STYLE[f.etat];
  const titre = [
    f.derniereSeance ? `Dernière séance : ${f.derniereSeance}` : null,
    f.derniereCollecte ? `Dernière collecte : ${new Date(f.derniereCollecte).toLocaleString('fr-FR')}` : null,
  ].filter(Boolean).join('\n');

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${s.texte}`}
      title={titre || 'Fraîcheur des cours'}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.point}`} aria-hidden />
      {texte}
    </span>
  );
}
