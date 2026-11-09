/**
 * Positions du Conseiller par famille de facteurs (table conseiller_facteurs,
 * écrite par le scraper). Le Conseiller s'ABSTIENT de tout verdict : un tiers
 * est une position dans la cote du jour, pas un conseil. Le frontend ne
 * recalcule jamais un tiers (spec conseiller v2 §12).
 */
export type Tier = 'haut' | 'milieu' | 'bas';
export type CleFamille = 'tendance' | 'risque' | 'valorisation' | 'qualite' | 'rendement';

export interface Famille {
  cle: CleFamille;
  titre: string;
  /** Ce que veut dire « tiers haut » pour cette famille. */
  haut: string;
}

export const FAMILLES: Famille[] = [
  { cle: 'tendance', titre: 'Tendance', haut: 'parcours le plus fort face au marché sur 60 et 120 séances' },
  { cle: 'risque', titre: 'Risque', haut: 'volatilité et plus forte baisse les plus faibles' },
  { cle: 'valorisation', titre: 'Valorisation', haut: 'PER et cours / fonds propres les plus bas de sa famille comptable' },
  { cle: 'qualite', titre: 'Qualité', haut: 'croissance du résultat et rentabilité des fonds propres les plus élevées' },
  { cle: 'rendement', titre: 'Rendement', haut: 'dividende le plus élevé rapporté au cours' },
];

export interface LigneFacteurs {
  code: string;
  date_marche: string;
  tiers: Partial<Record<CleFamille, Tier | null>>;
  effectifs?: Partial<Record<CleFamille, number>>;
  classe_liquidite: 'A' | 'B' | 'C' | 'D' | null;
}

export function libelleTier(t: Tier | null | undefined): string {
  if (t === 'haut') return 'Tiers haut';
  if (t === 'milieu') return 'Tiers médian';
  if (t === 'bas') return 'Tiers bas';
  return '—';
}

export function ligneValide(l: { code?: unknown; date_marche?: unknown; tiers?: unknown; classe_liquidite?: unknown }): boolean {
  return typeof l.code === 'string' && l.code.length > 0 && typeof l.date_marche === 'string' && l.tiers != null && typeof l.tiers === 'object';
}
