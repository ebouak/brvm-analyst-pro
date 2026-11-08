import { bpaAffichable, perAffichable, type Affichable } from './affichage';
import { capitalisationFcfa } from './capitalisation';

export interface EntreesRatiosBilan {
  cours: number | null;
  titres: number | null;
  resultatNet: number | null;
  chiffreAffaires: number | null;
  capitauxPropres: number | null;
  detteFinanciere: number | null;
  /** Capitalisation déjà arrêtée (voir `capitalisationFcfa`) ; à défaut cours × titres. */
  capitalisation?: number | null;
}

export interface RatiosBilan {
  capitalisation: number | null;
  bpa: Affichable;
  per: Affichable;
  /** capitalisation ÷ capitaux propres */
  pb: number | null;
  /** capitalisation ÷ chiffre d'affaires */
  ps: number | null;
  /** fraction (−0,44 = −44 %) */
  roe: number | null;
  /** fraction */
  margeNette: number | null;
  /** dette financière ÷ capitaux propres */
  gearing: number | null;
}

const rapport = (a: number | null, b: number | null): number | null =>
  a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0 ? null : a / b;

/**
 * Ratios publics, SOURCE UNIQUE : tous calculés sur le même jeu de comptes
 * (SYSCOHADA, voir `exerciceRetenu`). Fiche, /financials, /revue et dossier
 * l'appellent, aucun ne refait sa division.
 */
export function ratiosBilan(e: EntreesRatiosBilan): RatiosBilan {
  const capitalisation = e.capitalisation ?? capitalisationFcfa({ valorisation: null, cours: e.cours, titres: e.titres });
  const bpa = bpaAffichable(e.resultatNet, e.titres);
  const per = perAffichable(bpa.valeur != null && bpa.valeur > 0 && e.cours != null ? e.cours / bpa.valeur : null, bpa.valeur);
  const cpPositifs = e.capitauxPropres != null && e.capitauxPropres > 0 ? e.capitauxPropres : null;
  return {
    capitalisation,
    bpa,
    per,
    pb: rapport(capitalisation, cpPositifs),
    ps: rapport(capitalisation, e.chiffreAffaires != null && e.chiffreAffaires > 0 ? e.chiffreAffaires : null),
    roe: rapport(e.resultatNet, cpPositifs),
    margeNette: rapport(e.resultatNet, e.chiffreAffaires != null && e.chiffreAffaires > 0 ? e.chiffreAffaires : null),
    gearing: rapport(e.detteFinanciere, cpPositifs),
  };
}
