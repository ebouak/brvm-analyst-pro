import { FAMILLES, type CleFamille, type Tier } from './facteurs';

export type Profil = 'porteur' | 'partage' | 'fragile' | 'indetermine';
export type Tiers = Partial<Record<CleFamille, Tier | null>>;

export const LIBELLE_PROFIL: Record<Profil, string> = {
  porteur: 'Profil porteur',
  partage: 'Profil partagé',
  fragile: 'Profil fragile',
  indetermine: 'Lecture impossible',
};

const PHRASE_HAUT: Record<CleFamille, string> = {
  tendance: 'tendance forte face au marché',
  risque: 'peu volatile',
  valorisation: 'se paie peu cher face à son secteur',
  qualite: 'résultats et rentabilité solides',
  rendement: 'dividende élevé',
};
const PHRASE_BAS: Record<CleFamille, string> = {
  tendance: 'tendance faible face au marché',
  risque: 'volatile',
  valorisation: 'se paie cher face à son secteur',
  qualite: 'résultats et rentabilité faibles',
  rendement: 'dividende faible',
};

function compte(tiers: Tiers) {
  let haut = 0, bas = 0, dispo = 0;
  for (const f of FAMILLES) {
    const t = tiers?.[f.cle] ?? null;
    if (t) dispo++;
    if (t === 'haut') haut++;
    if (t === 'bas') bas++;
  }
  return { haut, bas, dispo };
}

/** Solde hauts − bas, utilisé pour trier. */
export function soldeDe(tiers: Tiers): number {
  const c = compte(tiers);
  return c.haut - c.bas;
}

/**
 * Règle de présentation, pas une règle testée : seuil choisi pour différencier la cote (mesure du 2026-11-09 : 8 / 28 / 11 / 1).
 */
export function profilDe(tiers: Tiers): Profil {
  const { haut, bas, dispo } = compte(tiers);
  if (dispo < 2) return 'indetermine';
  const solde = haut - bas;
  if (solde >= 2) return 'porteur';
  if (solde <= -2) return 'fragile';
  return 'partage';
}

export function phraseDe(tiers: Tiers): string {
  const { dispo } = compte(tiers);
  if (dispo < 2) return 'Données insuffisantes pour une lecture.';
  const fav = FAMILLES.filter((f) => tiers?.[f.cle] === 'haut').map((f) => PHRASE_HAUT[f.cle]);
  const def = FAMILLES.filter((f) => tiers?.[f.cle] === 'bas').map((f) => PHRASE_BAS[f.cle]);
  if (fav.length === 0 && def.length === 0) return 'Aucune famille ne se distingue de la cote.';
  const texte = [fav.join(', '), def.join(', ')].filter(Boolean).join(' ; ');
  return texte.charAt(0).toUpperCase() + texte.slice(1) + '.';
}
