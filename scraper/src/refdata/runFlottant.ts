import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { fetchTickers } from '../dividends/runDividendHistory.js';
import { parseFrNumber } from '../utils/parseNumber.js';

/**
 * Flottant (brvm_instruments.flottant) depuis les fiches société Sika Finance.
 *
 * Remplace `details` (RichBourse), qui répond 403 « extraction automatique non
 * autorisée » : le job restait vert sans rien écrire, et le flottant de SNTS est
 * resté à sa valeur d'avant le fractionnement du 26/10/2026 (2,4 % du capital,
 * contre 22,47 % publiés). Ces fiches sont autorisées par le robots.txt de Sika
 * et déjà lues par `dividend-history`.
 *
 * Sika publie un POURCENTAGE, la colonne porte un nombre de titres : on multiplie
 * par NOTRE nombre de titres, après avoir vérifié qu'il égale le sien. Un écart
 * signale une opération sur titres non reportée d'un côté ou de l'autre : on
 * n'écrit rien et on le nomme, plutôt que de produire un chiffre faux et plausible.
 *
 * Contrairement à `details`, un échec se voit : sous 50 % de valeurs écrites, le
 * statut est `failed` et le workflow passe au rouge.
 */

export interface FicheSika {
  titres: number | null;
  flottantPct: number | null;
}

/** Fonction pure. Absent ou illisible → null, jamais de valeur devinée. */
export function lireFicheSika(html: string): FicheSika {
  const texte = cheerio.load(html)('body').text().replace(/\s+/g, ' ');
  const titres = /Nombre de titres\s*:\s*(\d[\d\s]*)/i.exec(texte)?.[1];
  const pct = /Flottant\s*:\s*(\d+(?:[.,]\d+)?)\s*%/i.exec(texte)?.[1];
  return { titres: titres ? parseFrNumber(titres) : null, flottantPct: pct ? parseFrNumber(pct) : null };
}

/** Écart toléré entre nos titres et ceux de Sika. */
export const ECART_TITRES_MAX = 0.01;

export type VerdictFlottant =
  | { etat: 'ok'; flottant: number }
  | { etat: 'absent' }
  | { etat: 'titres_discordants'; nous: number; sika: number };

/** Fonction pure : décide ce qu'on écrit pour une valeur. */
export function flottantEnTitres(fiche: FicheSika, titresBase: number | null): VerdictFlottant {
  const { titres, flottantPct } = fiche;
  if (!titres || !titresBase || flottantPct == null || flottantPct <= 0 || flottantPct > 100) return { etat: 'absent' };
  if (Math.abs(titres / titresBase - 1) > ECART_TITRES_MAX) return { etat: 'titres_discordants', nous: titresBase, sika: titres };
  return { etat: 'ok', flottant: Math.round((flottantPct / 100) * titresBase) };
}

const BASE = 'https://www.sikafinance.com';
const UA = 'Mozilla/5.0 (compatible; WestbourseBot/1.0; +https://www.westbourse.com)';
const PAUSE_MS = 1000;

export interface ResultatFlottant {
  status: 'ok' | 'failed';
  valeurs: number;
  ecrites: number;
  absents: string[];
  discordants: string[];
  echecs: string[];
}

export async function runFlottant(opts: { mock?: boolean; dryRun?: boolean } = {}): Promise<ResultatFlottant> {
  const r: ResultatFlottant = { status: 'ok', valeurs: 0, ecrites: 0, absents: [], discordants: [], echecs: [] };
  if (opts.mock) {
    logger.info('flottant : mode mock, rien collecté');
    return r;
  }

  const db = getSupabase();
  const { data, error } = await db.from('brvm_instruments').select('code, shares');
  if (error) throw new Error(`flottant : instruments illisibles (${error.message})`);
  const titres = new Map((data ?? []).map((l) => [l.code as string, l.shares as number | null]));

  const tickers = await fetchTickers();
  r.valeurs = tickers.length;

  for (const ticker of tickers) {
    const code = (ticker.split('.')[0] ?? ticker).toUpperCase();
    try {
      const resp = await fetch(`${BASE}/marches/societe/${ticker}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(25000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const verdict = flottantEnTitres(lireFicheSika(await resp.text()), titres.get(code) ?? null);

      if (verdict.etat === 'absent') r.absents.push(code);
      else if (verdict.etat === 'titres_discordants') {
        r.discordants.push(code);
        logger.warn(verdict, `flottant : ${code} écarté, nombre de titres discordant`);
      } else {
        if (!opts.dryRun) {
          const { error: e } = await db.from('brvm_instruments').update({ flottant: verdict.flottant }).eq('code', code);
          if (e) throw new Error(e.message);
        }
        r.ecrites++;
        logger.info({ code, flottant: verdict.flottant }, opts.dryRun ? 'flottant : à blanc' : 'flottant : écrit');
      }
    } catch (e) {
      r.echecs.push(code);
      logger.error({ code, err: (e as Error).message }, 'flottant : échec');
    }
    await new Promise((f) => setTimeout(f, PAUSE_MS));
  }

  if (r.ecrites < r.valeurs / 2) r.status = 'failed';
  logger.info(r, 'flottant : terminé');
  return r;
}
