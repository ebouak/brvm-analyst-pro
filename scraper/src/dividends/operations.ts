/**
 * Dividendes et opérations sur titres (fractionnement, regroupement).
 *
 * Après le fractionnement SNTS du 26/10/2026 (1 → 10, migration 0166), la base
 * exprime les dividendes passés en actions d'aujourd'hui : 1 740 F devient 174 F.
 * Les sources, elles, n'ajustent pas toutes leur historique — le calendrier
 * BRVM publie encore 1 740 F pour l'exercice 2025. Sans cette garde, le cron
 * hebdomadaire réécrirait l'ancienne échelle par-dessus la correction.
 *
 * Règle : un montant relu ≈ ratio × la valeur en base (à 2 % près) est la même
 * donnée à l'échelle d'avant ; il est ramené. Tout autre écart reste une
 * révision légitime et passe tel quel. Sans valeur en base, rien n'est deviné.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

export interface OperationTitre {
  code: string;
  ratio: number;
}

const TOLERANCE = 0.02;

type LigneDividende = {
  code: string;
  exercice?: number | null;
  montant?: number | null;
  montant_brut?: number | null;
};

/** Ramène à l'échelle actuelle les montants relus à l'échelle d'avant une opération. */
export function ramenerEchelle<T extends LigneDividende>(
  rows: T[],
  operations: OperationTitre[],
  existants: Map<string, number>,
): { rows: T[]; ramenees: string[] } {
  const ramenees: string[] = [];
  const out = rows.map((r) => {
    if (r.exercice == null || !(r.montant != null && r.montant > 0)) return r;
    const enBase = existants.get(`${r.code}|${r.exercice}`);
    if (!(enBase != null && enBase > 0)) return r;
    for (const op of operations) {
      if (op.code !== r.code) continue;
      if (Math.abs(r.montant / enBase / op.ratio - 1) <= TOLERANCE) {
        ramenees.push(`${r.code}|${r.exercice}`);
        return {
          ...r,
          montant: r.montant / op.ratio,
          ...(r.montant_brut != null ? { montant_brut: r.montant_brut / op.ratio } : {}),
        };
      }
    }
    return r;
  });
  return { rows: out, ramenees };
}

/**
 * Charge les opérations appliquées et les montants en base des codes concernés.
 * Table absente (0166 non appliquée) : aucune opération, la garde ne fait rien.
 */
export async function chargerGardeOperations(): Promise<{
  operations: OperationTitre[];
  existants: Map<string, number>;
}> {
  const sb = getSupabase();
  const { data: ops, error } = await sb
    .from('operations_titres')
    .select('code, ratio')
    .not('applique_le', 'is', null);
  if (error) {
    logger.warn({ err: error.message }, 'operations_titres illisible — garde des dividendes inactive');
    return { operations: [], existants: new Map() };
  }
  const operations = ((ops ?? []) as { code: string; ratio: number | string }[]).map((o) => ({
    code: o.code,
    ratio: Number(o.ratio),
  }));
  if (operations.length === 0) return { operations, existants: new Map() };
  const { data: divs, error: e } = await sb
    .from('dividends')
    .select('code, exercice, montant')
    .in('code', [...new Set(operations.map((o) => o.code))]);
  if (e) throw new Error(`dividends (garde opérations) : ${e.message}`);
  const existants = new Map<string, number>();
  for (const d of (divs ?? []) as { code: string; exercice: number | null; montant: number | null }[]) {
    if (d.exercice != null && d.montant != null) existants.set(`${d.code}|${d.exercice}`, Number(d.montant));
  }
  return { operations, existants };
}

/** Applique la garde à un lot avant écriture, et journalise ce qui a été ramené. */
export async function garderEchelle<T extends LigneDividende>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const { operations, existants } = await chargerGardeOperations();
  const { rows: out, ramenees } = ramenerEchelle(rows, operations, existants);
  if (ramenees.length) logger.info({ ramenees }, 'dividendes relus à l’échelle d’avant opération — ramenés');
  return out;
}
