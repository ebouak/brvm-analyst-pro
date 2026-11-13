import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { listerBulletins, telechargerPdf, type BulletinPublie } from '../carnet/fetch.js';
import { itemsDesPages } from '../dividends/runDividendesBoc.js';
import { lireCoteBoc, dateSeanceBoc, type CoteBoc } from './cote.js';

/**
 * Collecte de la cote officielle (Bulletin Officiel de la Cote) dans
 * `boc_cote_daily` : statut (cotée / suspendue), clôture, cours de référence,
 * PER, dividende net et rendement publiés par la BRVM.
 *
 * Une exécution = un bulletin (le plus récent, ou `date`). Idempotent : upsert
 * sur (code, date_marche), séance déjà en base sautée.
 *
 * VERROUS, parce qu'un cron non surveillé ne doit pas écrire une lecture
 * fausse : moins de 40 valeurs lues = page mal lue, rien n'est écrit ; une
 * date de pied de page différente de celle du nom de fichier = bulletin
 * incohérent, rien n'est écrit.
 *
 * Le calcul des ÉCARTS avec les ratios du site n'est PAS fait ici : il passe
 * par les fonctions mêmes qui affichent ces ratios (frontend/lib/boc/ecarts.ts,
 * route /api/cron/controle-boc). Les recopier dans ce paquet aurait créé deux
 * PER destinés à diverger.
 */

export const MIN_VALEURS = 40;

export interface CoteRunResult {
  date: string;
  lues: number;
  suspendues: string[];
  ecrites: number;
  saute: boolean;
}

export function versBase(l: CoteBoc, date: string, url: string) {
  return {
    code: l.code,
    date_marche: date,
    statut: l.statut,
    cours_cloture: l.cours_cloture,
    cours_reference: l.cours_reference,
    per: l.per,
    rendement_net_pct: l.rendement_net_pct,
    dividende_net: l.dividende_net,
    dividende_date: l.dividende_date,
    source_url: url,
  };
}

export async function runCoteBoc(opts: { date?: string } = {}): Promise<CoteRunResult> {
  const bulletins = await listerBulletins();
  const cible: BulletinPublie | undefined = opts.date ? bulletins.find((b) => b.date === opts.date) : bulletins[0];
  if (!cible) throw new Error(opts.date ? `aucun bulletin publié pour la séance ${opts.date}` : 'aucun bulletin listé sur brvm.org');

  const sb = getSupabase();
  const { count, error: eCount } = await sb
    .from('boc_cote_daily')
    .select('code', { count: 'exact', head: true })
    .eq('date_marche', cible.date);
  if (eCount) throw new Error(`boc_cote_daily illisible : ${eCount.message}`);
  if ((count ?? 0) >= MIN_VALEURS && !opts.date) {
    logger.info({ date: cible.date, lignes: count }, 'cote du bulletin déjà collectée, rien à faire');
    return { date: cible.date, lues: count ?? 0, suspendues: [], ecrites: 0, saute: true };
  }

  const pages = await itemsDesPages(await telechargerPdf(cible.url));
  const dateLue = dateSeanceBoc(pages);
  if (dateLue && dateLue !== cible.date) {
    throw new Error(`bulletin incohérent : fichier du ${cible.date}, pied de page du ${dateLue} — rien n'est écrit`);
  }
  const lues = lireCoteBoc(pages);
  if (lues.length < MIN_VALEURS) {
    throw new Error(`seulement ${lues.length} valeurs lues dans ${cible.url} : lecture suspecte, rien n'est écrit`);
  }

  const rows = lues.map((l) => versBase(l, cible.date, cible.url));
  const { error } = await sb.from('boc_cote_daily').upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`écriture de boc_cote_daily refusée : ${error.message}`);

  const res: CoteRunResult = {
    date: cible.date,
    lues: lues.length,
    suspendues: lues.filter((l) => l.statut === 'suspendu').map((l) => l.code),
    ecrites: rows.length,
    saute: false,
  };
  logger.info(res, 'cote officielle collectée');
  return res;
}
