import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { parseBrvmPublic, parseBrvmResumeIndices } from './brvmPublic.js';
import { ensureIndexInstruments, ensureActionInstruments, upsertActions, upsertIndices, upsertMarketSummary, insertIntradaySnapshots } from '../persistence/repository.js';
import { getSupabase } from '../persistence/supabase.js';
import { memeSeanceQuePrecedente, type LigneComparable } from './preuveDeSeance.js';
import type { IndiceRow } from '../types.js';

const BRVM_PUBLIC_URL = 'https://www.brvm.org/fr/cours-actions/0';
const BRVM_RESUME_URL = 'https://www.brvm.org/fr/resume';

function fixture(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '..', '..', 'tests', 'fixtures', name), 'utf8');
}

/** Récupère le HTML des cours actions : réseau, ou fixture locale en mode mock. */
async function getHtml(mock: boolean): Promise<string> {
  if (mock) return fixture('brvm-public.html');
  const resp = await fetch(BRVM_PUBLIC_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org HTTP ${resp.status}`);
  return resp.text();
}

/** Récupère le HTML de la page « Résumé » (11 indices) : réseau ou fixture mock. */
async function getResumeHtml(mock: boolean): Promise<string> {
  if (mock) return fixture('brvm-resume.html');
  const resp = await fetch(BRVM_RESUME_URL, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`brvm.org résumé HTTP ${resp.status}`);
  return resp.text();
}

/**
 * Fusionne les indices : la page « Résumé » (11 indices, plus complète) prime ;
 * on conserve d'éventuels indices de la table « Activités du marché » non couverts.
 */
function mergeIndices(activity: IndiceRow[], resume: IndiceRow[]): IndiceRow[] {
  const byCode = new Map<string, IndiceRow>();
  for (const i of activity) byCode.set(i.code, i);
  for (const i of resume) byCode.set(i.code, i);
  return [...byCode.values()];
}

/** Dernière séance en base STRICTEMENT antérieure à `today` (lignes comparables). */
async function derniereSeancePrecedente(today: string): Promise<{ date: string; lignes: LigneComparable[] } | null> {
  const sb = getSupabase();
  const { data: d } = await sb.from('brvm_actions_daily').select('date_marche').lt('date_marche', today)
    .order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const date = (d?.date_marche as string | undefined) ?? null;
  if (!date) return null;
  const { data: rows } = await sb.from('brvm_actions_daily').select('code, cours_jour, variation_pct, volume').eq('date_marche', date);
  return { date, lignes: (rows ?? []) as LigneComparable[] };
}

export async function runIntraday(opts: { mock?: boolean } = {}): Promise<{ nbActions: number; nbIndices: number }> {
  const mock = opts.mock ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const html = await getHtml(mock);
  const snapshot = parseBrvmPublic(html, today);
  snapshot.is_mock = mock;

  if (snapshot.actions.length === 0) {
    throw new Error('intraday : aucune action parsée (page brvm.org inattendue ?)');
  }

  // Indices : on enrichit avec la page « Résumé » (11 indices vs 2 sur la page cours).
  try {
    const resumeHtml = await getResumeHtml(mock);
    const resumeIndices = parseBrvmResumeIndices(resumeHtml);
    if (resumeIndices.length > 0) {
      snapshot.indices = mergeIndices(snapshot.indices, resumeIndices);
    }
  } catch (err) {
    // Non bloquant : on conserve au minimum les indices de la table « Activités du marché ».
    logger.warn({ err: (err as Error).message }, 'intraday : page Résumé indices indisponible');
  }

  let nbSummary = 0;
  if (!mock) {
    // PREUVE DE SÉANCE. brvm.org ne date pas sa page ; avant les premiers
    // échanges (et tout un jour férié) elle montre encore la séance précédente.
    // Si le snapshot est identique ligne à ligne à la dernière séance en base,
    // on n'écrit RIEN sous la date du jour (voir preuveDeSeance.ts).
    const prec = await derniereSeancePrecedente(today);
    if (prec) {
      const verdict = memeSeanceQuePrecedente(snapshot.actions, prec.lignes);
      if (verdict.memeSeance) {
        logger.warn({ today, precedente: prec.date, ...verdict }, 'intraday : la page montre encore la séance précédente — aucune écriture');
        return { nbActions: 0, nbIndices: 0 };
      }
      logger.info({ today, precedente: prec.date, identiques: verdict.identiques, comparees: verdict.comparees }, 'intraday : séance nouvelle confirmée');
    }
    // Crée seulement les instruments MANQUANTS — indices sectoriels et valeurs
    // nouvellement admises à la cote — sans jamais toucher aux lignes
    // existantes, sinon on écraserait secteur/pays (renseignés par le scrape
    // quotidien) → « secteur Inconnu ».
    //
    // Les actions étaient supposées déjà présentes. C'était faux : le
    // 24/09/2026, l'admission de BBGC (Bridge Bank Group CI, 48e valeur) a fait
    // violer la clé étrangère `brvm_actions_daily_code_fkey`, et comme le lot
    // part en une seule requête, les 47 autres lignes sont tombées avec elle —
    // 25 séances de collecte perdues avant correction manuelle.
    await ensureIndexInstruments(snapshot.indices);
    const nouvellesActions = await ensureActionInstruments(snapshot.actions);
    if (nouvellesActions.length > 0) {
      // En `warn` délibérément : une entrée en cote est un événement rare, qui
      // demande ensuite une curation (secteur, pays, famille comptable, logo).
      logger.warn({ codes: nouvellesActions }, 'intraday : nouvelle(s) valeur(s) admise(s) à la cote — curation à faire');
    }
    await upsertActions(snapshot);
    // Historise cette capture (append) pour la détection de patterns intraday.
    // Non bloquant : un échec ne doit pas casser le scrape des cours.
    try {
      const nbSnap = await insertIntradaySnapshots(snapshot);
      logger.info({ nbSnap }, 'intraday : snapshots historisés');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'intraday : historisation snapshots échouée');
    }
    if (snapshot.indices.length > 0) await upsertIndices(snapshot);
    nbSummary = await upsertMarketSummary(snapshot);
  }
  logger.info(
    { nbActions: snapshot.actions.length, nbIndices: snapshot.indices.length, nbSummary, date: today, mock },
    'intraday terminé',
  );
  return { nbActions: snapshot.actions.length, nbIndices: snapshot.indices.length };
}
