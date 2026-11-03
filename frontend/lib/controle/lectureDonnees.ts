import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { DonneesFraicheur } from './donnees';

/**
 * Chargeur serveur du domaine « données » de la Tour de contrôle.
 *
 * Une table illisible LÈVE : la page en fait un signal « inconnu », jamais un
 * flux présenté comme sain. Requêtes légères seulement — `order(...).limit(1)`
 * sur des colonnes indexées (date_marche DESC partout), aucun scan complet.
 *
 * La vidéo vient d'un fichier PUBLIC (bucket `seance-video`, écrit par
 * video/publie.mjs, lu par lib/landing/videoSeance.ts). Objet introuvable =
 * vidéo absente, ce qui est un FAIT à juger, pas une erreur de lecture ; un
 * échec réseau ou une autre réponse, lui, lève.
 */

const CHEMIN_VIDEO = 'storage/v1/object/public/seance-video/derniere.json';
const DELAI_VIDEO_MS = 5000;
/** Assez large pour couvrir tout retard que l'évaluation sait qualifier. */
const FENETRE_FERIES_J = 31;

type Client = ReturnType<typeof getServiceClient>;

async function derniereDate(sb: Client, table: string, colonne = 'date_marche'): Promise<string | null> {
  const { data, error } = await sb.from(table).select(colonne).order(colonne, { ascending: false }).limit(1);
  if (error) throw new Error(`${table} illisible : ${error.message}`);
  const ligne = (data?.[0] ?? null) as unknown as Record<string, unknown> | null;
  const v = ligne?.[colonne];
  return typeof v === 'string' ? v : null;
}

async function collecteIntraday(sb: Client): Promise<string | null> {
  const { data, error } = await sb.from('v_fraicheur_cours').select('derniere_collecte_intraday').limit(1);
  if (error) throw new Error(`v_fraicheur_cours illisible : ${error.message}`);
  const v = (data?.[0] as { derniere_collecte_intraday?: unknown } | undefined)?.derniere_collecte_intraday;
  return typeof v === 'string' ? v : null;
}

async function calendrierDividendes(sb: Client, maintenant: Date): Promise<DonneesFraicheur['calendrierDividendes']> {
  // Même compte que scraper/scripts/verify-data.ts (dividends-calendrier).
  const depuis = maintenant.getUTCFullYear() - 2;
  const [compte, derniere] = await Promise.all([
    sb
      .from('dividends')
      .select('code', { count: 'exact', head: true })
      .eq('source', 'brvm-calendrier')
      .not('ex_date', 'is', null)
      .gte('exercice', depuis),
    sb
      .from('dividends')
      .select('exercice, source_url')
      .eq('source', 'brvm-calendrier')
      .order('exercice', { ascending: false })
      .limit(1),
  ]);
  if (compte.error) throw new Error(`dividends illisible : ${compte.error.message}`);
  if (derniere.error) throw new Error(`dividends illisible : ${derniere.error.message}`);
  const l = (derniere.data?.[0] ?? null) as { exercice: number | null; source_url: string | null } | null;
  // Ex. …/files/20261009_-_calendrier_de_paiement_des_dividendes_-_exercice_2025.pdf
  const m = l?.source_url?.match(/\/(\d{4})(\d{2})(\d{2})[^/]*$/);
  return {
    lignes: compte.count ?? 0,
    exercice: l?.exercice ?? null,
    dateDocument: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
  };
}

async function testsE2e(sb: Client): Promise<string | null> {
  const { data, error } = await sb
    .from('qa_runs')
    .select('fin_at')
    .eq('environnement', 'ci')
    .eq('statut', 'termine')
    .not('fin_at', 'is', null)
    .order('fin_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`qa_runs illisible : ${error.message}`);
  const v = (data?.[0] as { fin_at?: unknown } | undefined)?.fin_at;
  return typeof v === 'string' ? v : null;
}

async function feries(sb: Client, maintenant: Date): Promise<string[]> {
  const fin = maintenant.toISOString().slice(0, 10);
  const debut = new Date(maintenant.getTime() - FENETRE_FERIES_J * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('market_calendar')
    .select('date')
    .eq('is_trading_day', false)
    .gte('date', debut)
    .lte('date', fin);
  if (error) throw new Error(`market_calendar illisible : ${error.message}`);
  return (data ?? []).map((r) => String((r as { date: string }).date).slice(0, 10));
}

/** Date de séance de la dernière vidéo publiée, ou null si aucune n'est publiée. */
async function video(): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL absente : derniere.json non lisible');
  // Un échec réseau ou le délai dépassé lèvent ici, volontairement.
  const r = await fetch(`${base}/${CHEMIN_VIDEO}`, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_VIDEO_MS) });
  if (r.ok) {
    let d: { seance?: unknown };
    try {
      d = (await r.json()) as { seance?: unknown };
    } catch {
      return null; // fiche illisible : rien d'honnête à montrer, comme la landing
    }
    return typeof d.seance === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.seance) ? d.seance.slice(0, 10) : null;
  }
  if (r.status === 404) return null;
  // Le stockage Supabase répond 400 + {"error":"not_found","code":"NoSuchKey"}
  // pour un objet public introuvable (mesuré le 2026-11-03).
  if (r.status === 400) {
    const corps = (await r.json().catch(() => null)) as { code?: string } | null;
    if (corps?.code === 'NoSuchKey') return null;
  }
  throw new Error(`seance-video/derniere.json : HTTP ${r.status}`);
}

/**
 * Fin du dernier run RÉUSSI de la commande `daily` (consolidation de clôture).
 * Source absente du référentiel = jamais exécutée : null (le signal le dira).
 */
async function consolidationCloture(sb: ReturnType<typeof getServiceClient>): Promise<string | null> {
  const src = await sb.from('scraper_sources').select('id').eq('code', 'daily').maybeSingle();
  if (src.error) throw new Error(`scraper_sources illisible : ${src.error.message}`);
  if (!src.data) return null;
  const { data, error } = await sb
    .from('scraper_runs')
    .select('finished_at')
    .eq('source_id', src.data.id)
    .eq('status', 'success')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`scraper_runs illisible (consolidation) : ${error.message}`);
  return (data?.[0]?.finished_at as string | undefined) ?? null;
}

export async function chargerDonnees(maintenant = new Date()): Promise<DonneesFraicheur> {
  const sb = getServiceClient();
  const consolidation = consolidationCloture(sb);
  const [coursCloture, indices, intraday, signaux, liquidite, carnet, cal, e2e, fer, vid] = await Promise.all([
    derniereDate(sb, 'brvm_actions_daily'),
    derniereDate(sb, 'brvm_indices_daily'),
    collecteIntraday(sb),
    derniereDate(sb, 'signals_daily'),
    derniereDate(sb, 'liquidity_daily'),
    derniereDate(sb, 'brvm_carnet_daily'),
    calendrierDividendes(sb, maintenant),
    testsE2e(sb),
    feries(sb, maintenant),
    video(),
  ]);
  return {
    coursCloture,
    indices,
    collecteIntraday: intraday,
    signaux,
    liquidite,
    carnet,
    video: vid,
    calendrierDividendes: cal,
    testsE2e: e2e,
    feries: fer,
    consolidationCloture: await consolidation,
  };
}
