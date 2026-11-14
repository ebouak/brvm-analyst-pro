import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fenetreChargement, type DatedClose } from '../eventStudy';
import { reactionPublication } from '../reactionPublication';

const TRANCHE = 1000; // PostgREST tronque à 1000 lignes EN SILENCE

async function lireTout<T>(
  requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  nom: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += TRANCHE) {
    const { data, error } = await requete(de, de + TRANCHE - 1);
    if (error) throw new Error(`Lecture ${nom} impossible : ${error.message}`);
    const lot = data ?? [];
    out.push(...lot);
    if (lot.length < TRANCHE) break;
  }
  return out;
}

/**
 * Charge UNE fois les clôtures (actions concernées + BRVMC) puis calcule la réaction de chaque demande.
 * Clé de la Map : `${code}|${date}`. Lève une Error si une lecture échoue (jamais de zéros par défaut).
 */
export async function chargerReactions(
  sb: SupabaseClient,
  demandes: { code: string; date: string }[],
  horizon = 5,
): Promise<Map<string, ReturnType<typeof reactionPublication>>> {
  const res = new Map<string, ReturnType<typeof reactionPublication>>();
  if (demandes.length === 0) return res;

  let debut = '';
  let fin = '';
  for (const d of demandes) {
    const f = fenetreChargement(d.date);
    if (!debut || f.debut < debut) debut = f.debut;
    if (!fin || f.fin > fin) fin = f.fin;
  }
  const codes = [...new Set(demandes.map((d) => d.code))];

  const [actions, indices] = await Promise.all([
    lireTout<{ code: string; date_marche: string; cours_jour: number | null }>(
      (de, a) =>
        sb
          .from('brvm_actions_daily')
          .select('code,date_marche,cours_jour')
          .in('code', codes)
          .gte('date_marche', debut)
          .lte('date_marche', fin)
          .order('code')
          .order('date_marche')
          .range(de, a),
      'brvm_actions_daily',
    ),
    lireTout<{ date_marche: string; valeur: number | null }>(
      (de, a) =>
        sb
          .from('brvm_indices_daily')
          .select('date_marche,valeur')
          .eq('code', 'BRVMC')
          .gte('date_marche', debut)
          .lte('date_marche', fin)
          .order('date_marche')
          .range(de, a),
      'brvm_indices_daily',
    ),
  ]);

  const serieIndice: DatedClose[] = indices.map((r) => ({ date: r.date_marche, close: r.valeur }));
  const parCode = new Map<string, DatedClose[]>();
  for (const r of actions) {
    const s = parCode.get(r.code) ?? [];
    s.push({ date: r.date_marche, close: r.cours_jour });
    parCode.set(r.code, s);
  }
  for (const d of demandes) {
    res.set(`${d.code}|${d.date}`, reactionPublication(parCode.get(d.code) ?? [], serieIndice, d.date, horizon));
  }
  return res;
}
