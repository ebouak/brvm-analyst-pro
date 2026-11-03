/**
 * Lignes obligataires et rendement moyen de la séance. PUR et testé.
 *
 * Mêmes règles que la page /obligations (fonction locale `toRow` et calcul de
 * `avgBondYtm` dans app/obligations/page.tsx) : ce module en est l'extraction,
 * pour que le tableau de bord affiche EXACTEMENT le chiffre que l'on retrouve en
 * cliquant. Les formules financières (YTM par bisection, duration, années
 * restantes, lecture de la désignation) restent celles de `lib/bonds`.
 * La page /obligations peut remplacer sa copie locale par `versLigneObligation`
 * et `syntheseObligations` sans changer de résultat.
 */
import { yieldToMaturity, durations, yearsTo, parseObligationDesignation } from '@/lib/bonds';
import type { ObligationDaily } from '@/lib/types';
import type { ObligationRow } from '@/components/ObligationsTable';

/** Sous ce cours, l'obligation est à amortissement partiel : YTM sur nominal 10 000 trompeur. */
export const SEUIL_AMORTISSABLE = 8000;
/** Un YTM hors de ]0 ; 25[ % trahit une donnée incohérente : il est écarté. */
export const YTM_MAX_PLAUSIBLE = 25;

/** Émetteur souverain / institution régionale → coupons exonérés de retenue (barème lib/tax). */
export function estEmetteurEtat(code: string, designation: string | null, emetteur: string | null): boolean {
  return /(TPCI|TPBJ|TPBF|TPSN|TPTG|TPNE|TPML|EOM|EOB|EOS|ETAT|TRESOR|TRÉSOR|BOAD|BIDC)/i.test(
    `${code} ${designation ?? ''} ${emetteur ?? ''}`,
  );
}

export function versLigneObligation(o: ObligationDaily, maintenant: Date = new Date()): ObligationRow {
  const parsed = parseObligationDesignation(o.designation);
  const emetteur = o.emetteur ?? parsed.emetteur;
  const tauxPct = o.taux_pct ?? parsed.couponPct;
  const maturite = o.maturite ?? parsed.maturite;
  const years = yearsTo(maturite, maintenant);

  const isAmortissable = o.cours_jour != null && o.cours_jour < SEUIL_AMORTISSABLE;

  let ytm: number | null = null;
  let modDur: number | null = null;
  if (!isAmortissable && o.cours_jour != null && tauxPct != null && years != null && years > 0) {
    const inputs = { prix: o.cours_jour, couponRatePct: tauxPct, yearsToMaturity: years, face: 10000 };
    ytm = yieldToMaturity(inputs);
    if (ytm != null && ytm > 0 && ytm < YTM_MAX_PLAUSIBLE) {
      modDur = durations(inputs, ytm)?.modified ?? null;
    } else {
      ytm = null;
    }
  }

  return {
    code: o.code,
    designation: o.designation,
    emetteur,
    taux_pct: tauxPct,
    maturite,
    cours_jour: o.cours_jour,
    volume: o.volume,
    yearsToMaturity: years,
    ytm,
    modifiedDuration: modDur,
    isAmortissable,
    couponExonere: estEmetteurEtat(o.code, o.designation, emetteur),
  };
}

export interface SyntheseObligations {
  actives: ObligationRow[];
  echues: ObligationRow[];
  /** Moyenne simple des YTM calculables des obligations actives ; null si aucune. */
  ytmMoyen: number | null;
  /** Nombre d'obligations actives entrant dans la moyenne. */
  nbAvecYtm: number;
}

export function syntheseObligations(rows: ObligationRow[]): SyntheseObligations {
  const actives = rows.filter((r) => r.yearsToMaturity != null && r.yearsToMaturity > 0);
  const echues = rows.filter((r) => r.yearsToMaturity == null || r.yearsToMaturity <= 0);
  const ytms = actives.map((r) => r.ytm).filter((y): y is number => y != null);
  const ytmMoyen = ytms.length ? ytms.reduce((a, b) => a + b, 0) / ytms.length : null;
  return { actives, echues, ytmMoyen, nbAvecYtm: ytms.length };
}
