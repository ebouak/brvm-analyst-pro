/**
 * Lecture des données du contrôle BOC. Les chargeurs LÈVENT sur une erreur de
 * base : une source illisible ne doit jamais passer pour « aucun écart »
 * (règle de /admin/controle : inconnu n'est jamais « ok »).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { pickBestFundamental } from '@/lib/fundamentals';
import { dividendePourRendement } from '@/lib/fiche/affichage';
import { controlerValeur, type CoteBocLigne, type ControleValeur, type DonneesSite } from './ecarts';

const COLONNES_COTE = 'code, date_marche, statut, cours_cloture, cours_reference, per, rendement_net_pct, dividende_net, dividende_date';

/** Cote officielle de la dernière séance collectée ; tableau vide si la table est vide. */
export async function derniereCoteBoc(sb: SupabaseClient): Promise<CoteBocLigne[]> {
  const { data: d, error: e1 } = await sb.from('boc_cote_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  if (e1) throw new Error(`boc_cote_daily illisible : ${e1.message}`);
  const date = (d?.[0] as { date_marche: string } | undefined)?.date_marche;
  if (!date) return [];
  const { data, error } = await sb.from('boc_cote_daily').select(COLONNES_COTE).eq('date_marche', date);
  if (error) throw new Error(`boc_cote_daily illisible : ${error.message}`);
  return (data ?? []) as CoteBocLigne[];
}

/** Dernière ligne de cote officielle d'une valeur (fiche société) ; null si absente ou illisible. */
export async function coteBocValeur(sb: SupabaseClient, code: string): Promise<CoteBocLigne | null> {
  const { data, error } = await sb
    .from('boc_cote_daily')
    .select(COLONNES_COTE)
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  // Une fiche publique ne tombe pas parce que la table de contrôle est absente :
  // le badge retombe alors sur « Calculé » sans référence.
  if (error) return null;
  return (data as CoteBocLigne | null) ?? null;
}

/** Comptes et dividende retenus PAR LE SITE, avec ses propres règles (fiche société). */
export async function donneesSite(sb: SupabaseClient, codes: string[]): Promise<Map<string, DonneesSite>> {
  const fonds = await fetchAllRows<{ code: string; year: number | null; revenue: number | null; net_income: number | null; equity: number | null; is_manual: boolean | null }>(
    (from, to) => sb.from('fundamentals').select('code, year, revenue, net_income, equity, is_manual').in('code', codes).order('code').range(from, to),
  );
  const { data: instr, error: eI } = await sb.from('brvm_instruments').select('code, shares').in('code', codes);
  if (eI) throw new Error(`brvm_instruments illisible : ${eI.message}`);
  const divs = await fetchAllRows<{ code: string; exercice: number | null; montant: number; ex_date: string | null }>(
    (from, to) =>
      sb.from('dividends').select('code, exercice, montant, ex_date').in('code', codes)
        .order('code').order('exercice', { ascending: false, nullsFirst: false }).range(from, to),
  );

  const titres = new Map(((instr ?? []) as { code: string; shares: number | null }[]).map((r) => [r.code, r.shares]));
  const out = new Map<string, DonneesSite>();
  for (const code of codes) {
    const best = pickBestFundamental(fonds.filter((f) => f.code === code));
    const div = dividendePourRendement(divs.filter((d) => d.code === code));
    out.set(code, {
      code,
      resultatNet: best?.net_income ?? null,
      titres: titres.get(code) ?? null,
      dividende: div?.montant ?? null,
    });
  }
  return out;
}

/** Contrôle complet de la dernière séance collectée. */
export async function controleBoc(sb: SupabaseClient): Promise<ControleValeur[]> {
  const cote = await derniereCoteBoc(sb);
  if (!cote.length) return [];
  const site = await donneesSite(sb, cote.map((c) => c.code));
  return cote.map((c) => controlerValeur(site.get(c.code) ?? null, c)).sort((a, b) => a.code.localeCompare(b.code));
}
