import 'server-only';
import { buildRealReturn, listCodes } from './inflation';
import { buildTrueReturn, ANNEE_DEBUT, ANNEE_FIN } from './trueReturnData';

/**
 * NORMALISE les deux moteurs de rendement sous UNE seule forme.
 *
 * Les deux écrans historiques (« rendement réel » et « rendement vrai »)
 * racontaient la MÊME histoire à une étape près :
 *
 *   cours seul  →  (+ dividendes nets réinvestis)  →  − inflation du pays
 *
 * - mode `reel` : cours seul − inflation. Horizon libre (3/5/10 ans), historique
 *   long. C'est l'ancienne page /rendement-reel.
 * - mode `vrai` : cours + dividendes nets réinvestis − inflation. Fenêtre fixe
 *   ({ANNEE_DEBUT}-{ANNEE_FIN}) car le réinvestissement exige une série de
 *   dividendes complète ET un historique de cours dense. C'est /rendement-vrai.
 *
 * Un seul composant client consomme cette forme et bascule d'un mode à l'autre.
 */

export type Mode = 'reel' | 'vrai';
export const HORIZONS = [3, 5, 10] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface UnifiedPays {
  code: string;
  nom: string;
  /** Inflation cumulée sur la période, en %. */
  cumulPct: number;
  /** Rendement RÉEL pour un investisseur de ce pays, en %. */
  realPct: number;
  /** Rendement réel annualisé, en % (null si non calculable). */
  realAnnualisePct: number | null;
  /** Ce que 1 000 000 FCFA deviennent en pouvoir d'achat. */
  pouvoirAchat: number;
  /** L'inflation a mangé le gain. */
  perte: boolean;
}

export interface UnifiedDividende {
  exercice: number;
  montantNet: number;
  coursReinvest: number;
}

export interface UnifiedReport {
  mode: Mode;
  code: string;
  nom: string | null;
  anneeDebut: number;
  anneeFin: number;
  /** Libellé de période affiché à l'utilisateur. */
  periodeLabel: string;
  coursDebut: number;
  coursFin: number;
  /** Rendement nominal du COURS SEUL, en % — ce que tout le monde affiche. */
  prixSeulPct: number;
  /** Rendement nominal cours (+ dividendes en mode vrai), en %. */
  totalNominalPct: number;
  /** Apport des dividendes, en points (0 en mode réel). */
  apportDividendesPts: number;
  /** Dividendes nets encaissés (vide en mode réel). */
  dividendes: UnifiedDividende[];
  /** Total des dividendes nets, par action détenue (0 en mode réel). */
  totalDividendesNets: number;
  pays: UnifiedPays[];
}

const CAPITAL_REF = 1_000_000;

/** Liste des titres — la même pour les deux modes (large, filtrée à la volée). */
export function listCodesUnified() {
  return listCodes();
}

/**
 * Construit le rapport unifié. Renvoie `null` si les données sont insuffisantes
 * pour le mode demandé — jamais d'extrapolation.
 */
export async function buildUnifiedReturn(
  code: string,
  mode: Mode,
  annees: Horizon,
): Promise<UnifiedReport | null> {
  return mode === 'vrai' ? fromVrai(code) : fromReel(code, annees);
}

/** mode réel : cours seul − inflation, horizon 3/5/10 ans. */
async function fromReel(code: string, annees: Horizon): Promise<UnifiedReport | null> {
  const r = await buildRealReturn(code, annees);
  if (!r) return null;

  return {
    mode: 'reel',
    code: r.code,
    nom: r.nom,
    anneeDebut: r.anneeDebut,
    anneeFin: r.anneeFin,
    periodeLabel: `${r.anneeDebut}–${r.anneeFin} · ${annees} ans · hors dividendes`,
    coursDebut: r.coursDebut,
    coursFin: r.coursFin,
    prixSeulPct: r.nominalPct,
    totalNominalPct: r.nominalPct,
    apportDividendesPts: 0,
    dividendes: [],
    totalDividendesNets: 0,
    pays: r.pays.map((p) => ({
      code: p.code,
      nom: p.nom,
      cumulPct: p.cumulPct,
      realPct: p.realPct,
      realAnnualisePct: p.realAnnualisePct,
      pouvoirAchat: p.pouvoirAchat,
      perte: p.destroysValue,
    })),
  };
}

/** mode vrai : cours + dividendes nets réinvestis − inflation, fenêtre fixe. */
async function fromVrai(code: string): Promise<UnifiedReport | null> {
  const r = await buildTrueReturn(code);
  if (!r || r.pays.length === 0) return null;

  // Cours et dividendes sont IDENTIQUES pour tous les pays : seule l'inflation
  // change. On lit donc le nominal sur le premier pays.
  const ref = r.pays[0]!.resultat;
  const nbAnnees = ANNEE_FIN - ANNEE_DEBUT + 1;

  return {
    mode: 'vrai',
    code: r.code,
    nom: r.designation,
    anneeDebut: ANNEE_DEBUT,
    anneeFin: ANNEE_FIN,
    periodeLabel: `${ANNEE_DEBUT}–${ANNEE_FIN} · dividendes nets réinvestis`,
    coursDebut: r.coursDebut,
    coursFin: r.coursFin,
    prixSeulPct: ref.prixSeulPct,
    totalNominalPct: ref.totalNominalPct,
    apportDividendesPts: ref.apportDividendesPts,
    dividendes: r.dividendes.map((d) => ({
      exercice: d.exercice,
      montantNet: d.montantNet,
      coursReinvest: d.coursReinvest,
    })),
    totalDividendesNets: r.totalDividendesNets,
    pays: r.pays.map((p) => {
      const v = p.resultat.vraiPct;
      const annualise = v <= -100 ? null : (Math.pow(1 + v / 100, 1 / nbAnnees) - 1) * 100;
      return {
        code: p.iso3,
        nom: p.nom,
        cumulPct: p.resultat.inflationCumulPct,
        realPct: v,
        realAnnualisePct: annualise === null ? null : Math.round(annualise * 100) / 100,
        pouvoirAchat: Math.round(CAPITAL_REF * (1 + v / 100)),
        perte: p.resultat.perteReelle,
      };
    }),
  };
}
