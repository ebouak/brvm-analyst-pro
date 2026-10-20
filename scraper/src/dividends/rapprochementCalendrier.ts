/**
 * Rapprochement du calendrier officiel avec la table HTML et avec la base —
 * module PUR et testé.
 */
import type { LigneCalendrier } from './calendrier.js';
import type { PaiementEsv } from './esv.js';

export interface MontantsBase {
  /** NET pour une personne physique — la convention de `dividends.montant`. */
  montant: number;
  montant_brut: number | null;
  taux_retenue: number | null;
}

/**
 * Ligne « (*) » : net = brut × (1 − taux lu dans la note du document), arrondi
 * à 4 décimales. Ligne nette : montant tel quel, brut NON reconstitué (le taux
 * du pays n'est pas donné par le document). Brut sans taux lisible → null : la
 * ligne est refusée plutôt que calculée avec un taux supposé.
 */
export function montantsPourBase(l: LigneCalendrier, tauxPersonnePhysique: number | null): MontantsBase | null {
  if (!l.brut) return { montant: l.montant, montant_brut: null, taux_retenue: null };
  if (tauxPersonnePhysique == null) return null;
  return {
    montant: Math.round(l.montant * (1 - tauxPersonnePhysique) * 1e4) / 1e4,
    montant_brut: l.montant,
    taux_retenue: tauxPersonnePhysique,
  };
}

export interface Divergence {
  ligne: LigneCalendrier;
  esv: PaiementEsv;
}

/**
 * Compare chaque ligne du calendrier à la ligne de la table qui porte le MÊME
 * avis. Dates divergentes → la ligne sort (deux sources officielles qui se
 * contredisent ne se tranchent pas). Avis absent de la table → retenue, non
 * recoupée.
 */
export function recouperDates(
  lignes: LigneCalendrier[],
  esv: PaiementEsv[],
): { retenues: { ligne: LigneCalendrier; recoupee: boolean }[]; divergences: Divergence[] } {
  const parAvis = new Map<string, PaiementEsv>();
  for (const e of esv) if (e.avis) parAvis.set(e.avis, e);
  const retenues: { ligne: LigneCalendrier; recoupee: boolean }[] = [];
  const divergences: Divergence[] = [];
  for (const ligne of lignes) {
    const e = parAvis.get(ligne.avis);
    if (!e) {
      retenues.push({ ligne, recoupee: false });
    } else if (e.paiement !== ligne.paiement || (e.ex_date != null && e.ex_date !== ligne.ex_date)) {
      divergences.push({ ligne, esv: e });
    } else {
      retenues.push({ ligne, recoupee: true });
    }
  }
  return { retenues, divergences };
}

export interface Cible extends MontantsBase {
  ex_date: string;
  payment_date: string;
  avis_brvm: string;
}

export interface LigneBase {
  montant: number | null;
  montant_brut: number | null;
  ex_date: string | null;
  payment_date: string | null;
  avis_brvm: string | null;
  source: string | null;
}

/**
 * concordant        : la base porte déjà exactement la ligne du calendrier ;
 * date_ajoutee      : même montant net, mais dates, brut, avis ou source à compléter ;
 * montant_different : montant net différent (écart imprimé avec les deux valeurs) ;
 * absent            : aucune ligne pour (code, exercice).
 */
export type Ecart = 'concordant' | 'date_ajoutee' | 'montant_different' | 'absent';

export function classer(cible: Cible, base: LigneBase | null): Ecart {
  if (!base || base.montant == null) return 'absent';
  if (Math.abs(base.montant - cible.montant) >= 0.01) return 'montant_different';
  const identique =
    base.ex_date === cible.ex_date &&
    base.payment_date === cible.payment_date &&
    base.avis_brvm === cible.avis_brvm &&
    (base.montant_brut ?? null) === cible.montant_brut &&
    base.source === 'brvm-calendrier';
  return identique ? 'concordant' : 'date_ajoutee';
}
