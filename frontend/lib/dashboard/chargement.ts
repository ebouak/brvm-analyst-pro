import 'server-only';
/**
 * Chargeurs serveur des blocs du tableau de bord. Lecture sous RLS avec la
 * session de l'utilisateur. Chaque chargeur renvoie `null` en cas d'erreur
 * (journalisée côté serveur) : le bloc affiche alors « indisponible », jamais
 * une liste vide trompeuse.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { derivePortfolio, type PortfolioState, type RawPosition, type PricePoint } from '@/lib/portfolio/derive';
import { toutesLesPages } from './pagination';
import type { DividendeSource, FermetureSource } from './agenda';
import type { PublicationSource } from './publications';
import type { LiquiditeSource } from './liquiditeBloc';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function journal(bloc: string, message: string): null {
  console.error(`[dashboard] ${bloc} : lecture impossible :`, message);
  return null;
}

export async function chargerPortefeuille(sb: SupabaseClient, userId: string, aujourdhui: string): Promise<{ etat: PortfolioState; depuis: string } | null> {
  const { data: raw, error } = await sb
    .from('portfolios_positions')
    .select('code, quantite, prix_entree, date_entree')
    .eq('user_id', userId)
    .gt('quantite', 0);
  if (error) return journal('portefeuille', error.message);
  const rows = (raw ?? []) as { code: string; quantite: number; prix_entree: number; date_entree: string | null }[];
  const codes = [...new Set(rows.map((r) => r.code).filter((c) => c && c !== LIQUIDITES_CODE))];
  const entrees = rows.filter((r) => r.code !== LIQUIDITES_CODE).map((r) => r.date_entree).filter((d): d is string => !!d).sort();
  // Fenêtre bornée à 12 mois : un portefeuille ancien et diversifié ne peut pas dépasser le plafond de pages.
  // derivePortfolio reporte les cours : une position entrée avant la fenêtre est valorisée dès le premier cours de la fenêtre.
  const plancher = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const depuis = entrees[0] && entrees[0] > plancher ? entrees[0] : plancher;

  try {
    const [historique, instruments] = await Promise.all([
      codes.length
        ? toutesLesPages<{ code: string; cours_jour: number; date_marche: string }>((de, a) =>
            sb.from('brvm_actions_daily').select('code, cours_jour, date_marche')
              .in('code', codes).gte('date_marche', depuis).lte('date_marche', aujourdhui).not('cours_jour', 'is', null)
              .order('date_marche', { ascending: true }).order('code', { ascending: true }).range(de, a))
        : Promise.resolve([]),
      codes.length
        ? sb.from('brvm_instruments').select('code, secteur').in('code', codes)
        : Promise.resolve({ data: [] as { code: string; secteur: string | null }[], error: null }),
    ]);
    if (instruments.error) return journal('portefeuille (secteurs)', instruments.error.message);
    const secteurParCode = new Map(((instruments.data ?? []) as { code: string; secteur: string | null }[]).map((r) => [r.code, r.secteur]));
    const prix = new Map<string, PricePoint[]>();
    for (const r of historique) {
      const serie = prix.get(r.code) ?? [];
      serie.push({ date: r.date_marche, cours: r.cours_jour });
      prix.set(r.code, serie);
    }
    const positions: RawPosition[] = rows.map((r) => {
      const liq = r.code === LIQUIDITES_CODE;
      return {
        code: r.code, quantite: r.quantite, prix_entree: r.prix_entree, date_entree: r.date_entree,
        secteur: liq ? 'Liquidités' : (secteurParCode.get(r.code) ?? 'Autres'), is_liquidites: liq,
      };
    });
    return { etat: derivePortfolio(positions, prix, aujourdhui), depuis };
  } catch (e) {
    return journal('portefeuille (cours)', e instanceof Error ? e.message : String(e));
  }
}

export async function chargerDividendes(sb: SupabaseClient, debut: string, fin: string): Promise<DividendeSource[] | null> {
  if (!ISO.test(debut) || !ISO.test(fin)) return journal('agenda (dividendes)', 'dates invalides');
  const { data, error } = await sb
    .from('dividends')
    .select('code, montant, ex_date, payment_date, base_fiscale, source')
    .or(`and(ex_date.gte.${debut},ex_date.lte.${fin}),and(payment_date.gte.${debut},payment_date.lte.${fin})`)
    .limit(500);
  if (error) return journal('agenda (dividendes)', error.message);
  return (data ?? []) as DividendeSource[];
}

export async function chargerFermetures(sb: SupabaseClient, debut: string, fin: string): Promise<FermetureSource[] | null> {
  if (!ISO.test(debut) || !ISO.test(fin)) return journal('agenda (calendrier)', 'dates invalides');
  const { data, error } = await sb
    .from('market_calendar')
    .select('date, holiday_name, is_trading_day')
    .gte('date', debut).lte('date', fin).eq('is_trading_day', false);
  if (error) return journal('agenda (calendrier)', error.message);
  return (data ?? []) as FermetureSource[];
}

export async function chargerPublications(sb: SupabaseClient, depuis: string): Promise<PublicationSource[] | null> {
  const { data, error } = await sb
    .from('publications')
    .select('code, date_publication, libelle, type_publication, source_url')
    .gte('date_publication', depuis)
    .order('date_publication', { ascending: false })
    .limit(200);
  if (error) return journal('publications', error.message);
  return (data ?? []) as PublicationSource[];
}

export async function chargerLiquidite(sb: SupabaseClient): Promise<{ dateMarche: string; lignes: LiquiditeSource[] } | null> {
  const { data: der, error: e1 } = await sb.from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  if (e1) return journal('liquidité', e1.message);
  const dateMarche = (der?.[0] as { date_marche: string } | undefined)?.date_marche;
  if (!dateMarche) return { dateMarche: '', lignes: [] };
  const { data, error } = await sb
    .from('liquidity_daily')
    .select('code, score, classe, spread_pct, spread_source, valeur_moyenne_30j')
    .eq('date_marche', dateMarche);
  if (error) return journal('liquidité', error.message);
  return { dateMarche, lignes: (data ?? []) as LiquiditeSource[] };
}

export type SerieIndice = { date: string; valeur: number }[];

/** 30 dernières séances de BRVMC et BRVM30 jusqu'à `jusquA` inclus, en ordre chronologique. */
export async function chargerTrajectoires(sb: SupabaseClient, jusquA: string, n = 30): Promise<Record<'BRVMC' | 'BRVM30', SerieIndice> | null> {
  const lire = (c: 'BRVMC' | 'BRVM30') => sb
    .from('brvm_indices_daily')
    .select('date_marche, valeur')
    .eq('code', c)
    .lte('date_marche', jusquA)
    .not('valeur', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(n);
  const [a, b] = await Promise.all([lire('BRVMC'), lire('BRVM30')]);
  const erreur = a.error ?? b.error;
  if (erreur) return journal('trajectoires', erreur.message);
  const serie = (d: unknown): SerieIndice =>
    ((d ?? []) as { date_marche: string; valeur: number }[])
      .filter((r) => Number.isFinite(Number(r.valeur)))
      .map((r) => ({ date: r.date_marche, valeur: Number(r.valeur) }))
      .reverse();
  const out: Record<'BRVMC' | 'BRVM30', SerieIndice> = { BRVMC: serie(a.data), BRVM30: serie(b.data) };
  return out;
}

/** Nombre de signaux par type pour une séance (moteur de signaux). */
export async function chargerCompteSignaux(sb: SupabaseClient, date: string): Promise<Record<string, number> | null> {
  const { data, error } = await sb.from('signals_daily').select('signal').eq('date_marche', date).limit(500);
  if (error) return journal('signaux (compte)', error.message);
  const c: Record<string, number> = {};
  for (const r of (data ?? []) as { signal: string }[]) c[r.signal] = (c[r.signal] ?? 0) + 1;
  return c;
}

export interface Actualite { titre: string; date_publication: string; source: string | null; source_url: string | null }

export async function chargerActualites(sb: SupabaseClient, aujourdhui: string, n = 5): Promise<Actualite[] | null> {
  const { data, error } = await sb
    .from('brvm_news')
    .select('titre, date_publication, source, source_url')
    .not('hidden', 'is', true)
    .lte('date_publication', aujourdhui)
    .order('date_publication', { ascending: false })
    .limit(n);
  if (error) return journal('actualités', error.message);
  return (data ?? []) as Actualite[];
}

export interface IndiceAfricain { code: string; libelle: string | null; place: string | null; date_marche: string; valeur: number | null; variation_pct: number | null }

export async function chargerAfrique(sb: SupabaseClient): Promise<IndiceAfricain[] | null> {
  const { data, error } = await sb
    .from('african_indices_daily')
    .select('code, libelle, place, date_marche, valeur, variation_pct')
    .order('date_marche', { ascending: false })
    .limit(30);
  if (error) return journal('indices africains', error.message);
  const derniers = new Map<string, IndiceAfricain>();
  for (const r of (data ?? []) as IndiceAfricain[]) if (!derniers.has(r.code)) derniers.set(r.code, r);
  return [...derniers.values()];
}

/** Nombre de motifs détectés pour une séance (le détail reste premium). */
export async function chargerCompteMotifs(sb: SupabaseClient, date: string): Promise<number | null> {
  const { count, error } = await sb.from('brvm_pattern_scores').select('*', { count: 'exact', head: true }).eq('date_marche', date);
  if (error) return journal('motifs (compte)', error.message);
  return count ?? 0;
}
