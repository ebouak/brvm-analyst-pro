/**
 * Détail de cotation par instrument depuis Sika Finance.
 *
 * Page calibrée (juin 2026) : https://www.sikafinance.com/marches/cotation_<SYMBOL>
 *   où <SYMBOL> provient du sélecteur dpShares (ex: BOAC.ci, BOAB.bj, PALC.ci).
 * Champs (panneau gauche, paires libellé/valeur) :
 *   Volume (titres) · Volume (XOF) · Ouverture · Plus haut · Plus bas
 *   · Clôture veille · Beta 1 an · RSI · Capital échangé · Valorisation (M XOF)
 *
 * Le SCRAPER lit l'externe ; le FRONTEND reste Supabase-only.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { parseFrNumber } from '../utils/parseNumber.js';

const log = logger.child({ module: 'sikaCotation' });
const BASE = 'https://www.sikafinance.com';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };

export interface CotationDetail {
  code: string;
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  cours_precedent: number | null;
  volume: number | null;
  valeur_echangee: number | null; // Volume XOF (capital échangé)
  beta_1an: number | null;
  valorisation: number | null; // XOF (M XOF × 1e6)
}

/** Récupère le mapping code BRVM → symbole Sika (BOAC → BOAC.ci) via dpShares. */
export async function fetchSymbolMap(): Promise<Record<string, string>> {
  const { data } = await axios.get<string>(`${BASE}/marches/secteurs`, {
    timeout: 20000, headers: H, responseType: 'text',
  });
  const $ = cheerio.load(data);
  const map: Record<string, string> = {};
  $('#dpShares option').each((_, o) => {
    const val = ($(o).attr('value') ?? '').trim(); // ex: BOAC.ci
    if (!val || val.includes(' ')) return;
    const code = val.split('.')[0]!.toUpperCase();
    if (code && !(code in map)) map[code] = val;
  });
  log.info({ count: Object.keys(map).length }, 'Symboles Sika récupérés');
  return map;
}

/** Texte « libellé valeur » de la première ligne du panneau matchant le libellé. */
function rowFor($: cheerio.CheerioAPI, label: RegExp): string | null {
  let found: string | null = null;
  $('table tr, ul li').each((_, el) => {
    if (found !== null) return;
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (label.test(txt)) found = txt;
  });
  return found;
}

/** Dernier nombre d'une ligne (la valeur suit toujours le libellé). */
function lastNumber(rowText: string | null): number | null {
  if (!rowText) return null;
  // capture le dernier groupe numérique FR (espaces = milliers), unité optionnelle.
  const m = rowText.match(/(\d[\d\s .,]*\d|\d)\s*(?:M?\s*X?OF|M|FCFA|%)?\s*$/i);
  return m ? parseFrNumber(m[1]!) : null;
}

/** Parse une page cotation_<symbol> en CotationDetail. */
export function parseCotation(html: string, code: string): CotationDetail {
  const $ = cheerio.load(html);
  const num = (re: RegExp): number | null => lastNumber(rowFor($, re));

  const valoRow = rowFor($, /valorisation/i);
  const valoM = lastNumber(valoRow);
  // Affiché en millions de XOF (« M XOF ») → convertir en XOF.
  const valorisation = valoM != null ? Math.round(valoM * 1_000_000) : null;

  return {
    code,
    ouverture: num(/ouverture/i),
    plus_haut: num(/plus\s*haut/i),
    plus_bas: num(/plus\s*bas/i),
    cours_precedent: num(/cl[ôo]ture\s*veille/i),
    volume: num(/volume\s*\(?\s*titres/i),
    valeur_echangee: num(/volume\s*\(?\s*(?:x?of|\))/i),
    beta_1an: num(/beta/i),
    valorisation,
  };
}

/** Récupère le détail de cotation pour les codes donnés (ou tous les actifs). */
export async function fetchCotationDetails(codes?: string[]): Promise<CotationDetail[]> {
  const sb = getSupabase();
  const { data: instruments, error } = await sb
    .from('brvm_instruments')
    .select('code')
    .eq('type', 'action')
    .eq('actif', true);
  if (error) throw new Error(`load instruments: ${error.message}`);

  const targetCodes = codes && codes.length
    ? codes
    : (instruments ?? []).map((i) => i.code as string);
  const symbolMap = await fetchSymbolMap();

  const out: CotationDetail[] = [];
  for (const code of targetCodes) {
    const symbol = symbolMap[code];
    if (!symbol) { log.warn({ code }, 'pas de symbole Sika'); continue; }
    try {
      const { data } = await axios.get<string>(`${BASE}/marches/cotation_${symbol}`, {
        timeout: 20000, headers: H, responseType: 'text',
      });
      const detail = parseCotation(data, code);
      out.push(detail);
    } catch (err) {
      log.warn({ code, symbol, err: err instanceof Error ? err.message : String(err) }, 'détail Sika échec');
    }
  }
  log.info({ count: out.length }, 'Détails de cotation récupérés');
  return out;
}
