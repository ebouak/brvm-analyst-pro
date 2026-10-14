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

export async function chargerPortefeuille(sb: SupabaseClient, userId: string, aujourdhui: string): Promise<PortfolioState | null> {
  const { data: raw, error } = await sb
    .from('portfolios_positions')
    .select('code, quantite, prix_entree, date_entree')
    .eq('user_id', userId)
    .gt('quantite', 0);
  if (error) return journal('portefeuille', error.message);
  const rows = (raw ?? []) as { code: string; quantite: number; prix_entree: number; date_entree: string | null }[];
  const codes = [...new Set(rows.map((r) => r.code).filter((c) => c && c !== LIQUIDITES_CODE))];
  const entrees = rows.filter((r) => r.code !== LIQUIDITES_CODE).map((r) => r.date_entree).filter((d): d is string => !!d).sort();
  const depuis = entrees[0] ?? new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);

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
    return derivePortfolio(positions, prix, aujourdhui);
  } catch (e) {
    return journal('portefeuille (cours)', e instanceof Error ? e.message : String(e));
  }
}

export async function chargerDividendes(sb: SupabaseClient, debut: string, fin: string): Promise<DividendeSource[] | null> {
  if (!ISO.test(debut) || !ISO.test(fin)) return journal('agenda', 'dates invalides');
  const { data, error } = await sb
    .from('dividends')
    .select('code, montant, ex_date, payment_date, base_fiscale, source')
    .or(`and(ex_date.gte.${debut},ex_date.lte.${fin}),and(payment_date.gte.${debut},payment_date.lte.${fin})`)
    .limit(500);
  if (error) return journal('agenda (dividendes)', error.message);
  return (data ?? []) as DividendeSource[];
}

export async function chargerFermetures(sb: SupabaseClient, debut: string, fin: string): Promise<FermetureSource[] | null> {
  if (!ISO.test(debut) || !ISO.test(fin)) return journal('agenda', 'dates invalides');
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
