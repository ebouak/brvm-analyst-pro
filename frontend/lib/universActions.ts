import type { SupabaseClient } from '@supabase/supabase-js';
import { computeYield } from '@/lib/dividends';
import type { SimAction } from '@/lib/budgetSimulator';

/** Action de l'univers : ce que lit le simulateur, plus pays et famille comptable. */
export interface ActionUnivers extends SimAction {
  pays: string | null;
  famille: string | null;
}

/**
 * Univers d'actions réel : cours du jour, rendement du dividende (dernier
 * exercice / cours) et performance 12 mois (cours d'une séance à 1 an ± 12 j).
 * Toute métrique manquante reste `null` — jamais inventée. Partagé par le
 * simulateur de budget et la recherche des sociétés : un seul calcul.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerUniversActions(supabase: SupabaseClient<any, any, any>): Promise<{ univers: ActionUnivers[]; dateSeance: string | null }> {
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = (lastRow?.[0]?.date_marche as string | undefined) ?? null;
  if (!lastDate) return { univers: [], dateSeance: null };

  const target = new Date(lastDate);
  target.setFullYear(target.getFullYear() - 1);
  const winFrom = new Date(target);
  winFrom.setDate(winFrom.getDate() - 12);
  const winTo = new Date(target);
  winTo.setDate(winTo.getDate() + 12);
  const iso = (d: Date) => d.toISOString().split('T')[0]!;

  const [{ data: instruments }, { data: lastQuotes }, { data: yearAgoQuotes }, { data: divData }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation, secteur, pays, famille_comptable').eq('type', 'action').eq('actif', true).order('code'),
    supabase.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate),
    supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, date_marche')
      .gte('date_marche', iso(winFrom))
      .lte('date_marche', iso(winTo))
      .order('date_marche', { ascending: true }),
    supabase.from('dividends').select('code, exercice, montant, base_fiscale').order('exercice', { ascending: false }).limit(500),
  ]);

  const coursByCode = new Map<string, number>();
  for (const q of lastQuotes ?? []) {
    if (q.cours_jour != null && q.cours_jour > 0) coursByCode.set(q.code as string, q.cours_jour as number);
  }

  const targetTime = target.getTime();
  const yearAgoByCode = new Map<string, { close: number; dist: number }>();
  for (const q of yearAgoQuotes ?? []) {
    if (q.cours_jour == null || q.cours_jour <= 0) continue;
    const dist = Math.abs(new Date(q.date_marche as string).getTime() - targetTime);
    const prev = yearAgoByCode.get(q.code as string);
    if (!prev || dist < prev.dist) yearAgoByCode.set(q.code as string, { close: q.cours_jour as number, dist });
  }

  // Dividende du dernier exercice (somme) ; `toutNet` : chaque montant est déjà net d'IRVM.
  const divByCode = new Map<string, { exercice: number; total: number; toutNet: boolean }>();
  for (const d of divData ?? []) {
    if (d.exercice == null || d.montant == null) continue;
    const code = d.code as string;
    const ex = d.exercice as number;
    const net = d.base_fiscale === 'net';
    const cur = divByCode.get(code);
    if (!cur || ex > cur.exercice) divByCode.set(code, { exercice: ex, total: d.montant as number, toutNet: net });
    else if (ex === cur.exercice) {
      cur.total += d.montant as number;
      cur.toutNet = cur.toutNet && net;
    }
  }

  const univers: ActionUnivers[] = [];
  for (const i of instruments ?? []) {
    const code = i.code as string;
    const prix = coursByCode.get(code);
    if (prix == null) continue; // pas de cours → action écartée
    const div = divByCode.get(code);
    const yearAgo = yearAgoByCode.get(code);
    univers.push({
      code,
      designation: (i.designation as string) ?? code,
      secteur: (i.secteur as string | null) ?? null,
      pays: (i.pays as string | null) ?? null,
      famille: (i.famille_comptable as string | null) ?? null,
      prix,
      rendement: div ? computeYield(div.total, prix) : null,
      rendementDejaNet: div?.toutNet ?? false,
      perf12: yearAgo ? ((prix - yearAgo.close) / yearAgo.close) * 100 : null,
    });
  }
  return { univers, dateSeance: lastDate };
}
