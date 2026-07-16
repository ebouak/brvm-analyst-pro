/**
 * SOURCE UNIQUE DE VÉRITÉ du dividende par action.
 *
 * ── Pourquoi ce module existe ──
 * Le rendement du dividende était recalculé dans une dizaine d'écrans (fondamentaux,
 * screener, fiche action, comparateur, conseiller…), chacun lisant la table
 * `dividends` à sa façon. Deux problèmes en découlaient :
 *   1. Les fiches sociétés Sikafinance sous-estiment le dividende (~12 % sur
 *      plusieurs titres) ; ces valeurs n'ont PAS de date de détachement (ex_date).
 *   2. Trier par `ex_date DESC` ne suffit pas : PostgreSQL place les NULL EN TÊTE
 *      d'un tri décroissant, si bien que la valeur société (ex_date nulle) était
 *      souvent retenue à la place de la valeur vérifiée.
 *
 * Ce module ne retient QUE les dividendes à DÉTACHEMENT DATÉ (ex_date non nulle) —
 * les seuls confirmés par un détachement réel — et expose le dividende de
 * l'exercice le plus récent par code. Tous les écrans doivent l'utiliser.
 */

export interface VerifiedDividend {
  code: string;
  montant: number;
  exercice: number | null;
  ex_date: string;
}

/** Ligne brute de la table dividends. */
export interface DivRow {
  code: string;
  montant: number | null;
  exercice: number | null;
  ex_date: string | null;
}

/**
 * Sélection PURE : pour chaque code, le dividende vérifié le plus récent.
 * Vérifié = ex_date non nulle ET montant > 0. « Le plus récent » = exercice le
 * plus élevé ; à exercice égal (ou nul), la date de détachement la plus récente.
 * Testable sans base.
 */
export function selectVerified(rows: DivRow[]): Map<string, VerifiedDividend> {
  const out = new Map<string, VerifiedDividend>();
  for (const r of rows) {
    if (!r.ex_date || !(typeof r.montant === 'number' && r.montant > 0)) continue;
    const cand: VerifiedDividend = { code: r.code, montant: r.montant, exercice: r.exercice, ex_date: r.ex_date };
    const prev = out.get(r.code);
    if (!prev || plusRecent(cand, prev)) out.set(r.code, cand);
  }
  return out;
}

/** a est-il plus récent que b ? Exercice d'abord, puis ex_date. */
function plusRecent(a: VerifiedDividend, b: VerifiedDividend): boolean {
  const ea = a.exercice ?? -1;
  const eb = b.exercice ?? -1;
  if (ea !== eb) return ea > eb;
  return a.ex_date > b.ex_date;
}

/** Rendement du dividende en % (net, tel que publié). Null si cours invalide. */
export function rendementDividende(montant: number, cours: number | null | undefined): number | null {
  if (cours == null || !(cours > 0)) return null;
  return Math.round((montant / cours) * 10000) / 100;
}

/**
 * Client Supabase minimal. Le builder PostgREST est « thenable » (pas une vraie
 * Promise) → on type le maillon final en PromiseLike pour accepter tout client
 * supabase-js (public, serveur ou service-role) sans conflit.
 */
interface QueryableClient {
  from(table: string): {
    select(cols: string): {
      not(col: string, op: string, val: null): {
        order(col: string, opts: { ascending: boolean }): PromiseLike<{ data: unknown }>;
      };
    };
  };
}

/**
 * Récupère les dividendes vérifiés par code depuis la base.
 * Accepte n'importe quel client supabase-js (public, serveur ou service-role).
 */
export async function getVerifiedDividends(sb: QueryableClient): Promise<Map<string, VerifiedDividend>> {
  const { data } = await sb
    .from('dividends')
    .select('code, montant, exercice, ex_date')
    .not('ex_date', 'is', null)
    .order('exercice', { ascending: false });
  return selectVerified((data ?? []) as DivRow[]);
}
