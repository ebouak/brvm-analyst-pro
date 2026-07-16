import { assessValueTrap, type TrapVerdict } from '@/lib/fundamentals/valueTrap';

/**
 * Jeu de données citable « Les pièges du PER à la BRVM ».
 *
 * Pour chaque action : PER (cours / BPA du dernier exercice) croisé avec la
 * trajectoire du résultat net → verdict value trap. Fonction PURE, testée.
 */

export interface PerTrapIncomeRow {
  code: string;
  periode: string;
  resultat_net: number | null;
  benefice_par_action: number | null;
}
export interface PerTrapCoursRow {
  code: string;
  cours_jour: number;
  designation: string | null;
}

export interface PerTrapRow {
  code: string;
  nom: string;
  cours: number;
  bpa: number | null;
  per: number | null;
  /** Dernier résultat net connu, FCFA. */
  netDernier: number | null;
  /** Exercice du dernier résultat net. */
  exercice: string;
  verdict: TrapVerdict;
  label: string;
  severity: 'danger' | 'warn' | 'good' | 'neutral';
  raison: string;
  cagr: number | null;
  baissesConsec: number;
}

const SEVERITY_ORDER: Record<PerTrapRow['severity'], number> = { danger: 0, warn: 1, good: 2, neutral: 3 };
// À l'intérieur de « danger », on remonte d'abord les décotes pièges (PER bas
// trompeur) avant les bénéfices effondrés (PER déjà visiblement anormal).
const VERDICT_ORDER: Partial<Record<TrapVerdict, number>> = {
  'trap-decote-piege': 0, 'perte': 1, 'trap-benefice-effondre': 2,
};

export function buildPerValueTrap(
  income: PerTrapIncomeRow[],
  cours: PerTrapCoursRow[],
): PerTrapRow[] {
  const coursByCode = new Map<string, PerTrapCoursRow>();
  for (const c of cours) if (c.cours_jour != null) coursByCode.set(c.code, c);

  const byCode = new Map<string, PerTrapIncomeRow[]>();
  for (const r of income) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }

  const rows: PerTrapRow[] = [];
  for (const [code, series] of byCode) {
    const px = coursByCode.get(code);
    if (!px) continue;
    const chrono = [...series].sort((a, b) => a.periode.localeCompare(b.periode));
    const latest = chrono[chrono.length - 1]!;
    const bpa = latest.benefice_par_action;
    const per = bpa != null && bpa > 0 ? px.cours_jour / bpa : null;

    const trap = assessValueTrap({
      per,
      netIncomeSeries: chrono.map((r) => r.resultat_net),
    });

    rows.push({
      code,
      nom: px.designation ?? code,
      cours: px.cours_jour,
      bpa,
      per,
      netDernier: latest.resultat_net,
      exercice: latest.periode,
      verdict: trap.verdict,
      label: trap.label,
      severity: trap.severity,
      raison: trap.raison,
      cagr: trap.metrics.cagr,
      baissesConsec: trap.metrics.baissesConsec,
    });
  }

  rows.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const vo = (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9);
    if (vo !== 0) return vo;
    return (a.per ?? 9999) - (b.per ?? 9999); // PER croissant à sévérité égale
  });
  return rows;
}

/** Compte des titres par catégorie de verdict — pour la réponse courte. */
export function perTrapSummary(rows: PerTrapRow[]): Record<TrapVerdict, number> {
  const acc = {} as Record<TrapVerdict, number>;
  for (const r of rows) acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
  return acc;
}
