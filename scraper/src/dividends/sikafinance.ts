/**
 * Scraper des dividendes BRVM depuis sikafinance.com.
 *
 * Deux tables exploitées (HTML statique, pas de JS) :
 *  - #tbdDiv  : dividendes à venir/récents — Date détachement | Nom | Montant | Rendement
 *  - #tblDiv2 : historique pluriannuel — Nom | Div. YYYY | Rend. YYYY | ...
 *
 * Le mapping nom société -> code BRVM réutilise le référentiel brvm_instruments
 * (désignation) avec un fuzzy par tokens + une map curée pour les cas durs.
 *
 * NB : le SCRAPER peut lire des sources externes ; seul le FRONTEND reste
 * couplé à Supabase uniquement.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { parseFrNumber } from '../utils/parseNumber.js';
import { parseFrDate } from '../utils/dates.js';
import type { Dividend } from './types.js';

const SIKA_URL = 'https://www.sikafinance.com/marches/dividendes';

// --- mapping nom sikafinance -> code BRVM ----------------------------------
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'ci', 'sn', 'bf', 'tg', 'bj', 'ne', 'ml', 'gw', 'sa', 'sas', 'sarl',
  'group', 'groupe', 'cote', 'ivoire', 'd', 'de', 'du', 'des', 'la', 'le',
  'les', 'et', 'pour', 'benin', 'burkina', 'faso', 'mali', 'niger',
  'senegal', 'togo', 'guinee', 'bissau',
]);

function tokens(s: string): string[] {
  return normalizeStr(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let inter = 0;
  for (const t of ta) {
    if (setB.has(t)) inter += 1;
    else if (tb.some((x) => x.startsWith(t) || t.startsWith(x))) inter += 0.6;
  }
  return inter / Math.max(ta.length, tb.length);
}

interface Instrument {
  code: string;
  designation: string | null;
}

/** Construit un matcher nom -> code à partir du référentiel + alias curés. */
function buildMatcher(instruments: Instrument[]): (name: string) => string | null {
  // Alias curés : fragment de nom sikafinance (normalisé, en minuscule) -> code BRVM.
  const CURATED: Array<[RegExp, string]> = [
    [/bank of africa senegal/, 'BOAS'],
    [/bank of africa mali/, 'BOAM'],
    [/bank of africa niger/, 'BOAN'],
    [/bank of africa benin/, 'BOAB'],
    [/bank of africa burkina/, 'BOABF'],
    [/bank of africa.*ivoire|bank of africa ci/, 'BOAC'],
    [/orange ci|orange cote/, 'ORAC'],
    [/sonatel/, 'SNTS'],
    [/sicable/, 'CABC'],
    [/africa global logist/, 'SDSC'],
    [/sodeci/, 'SDCC'],
    [/sgbci|societe generale.*ivoire/, 'SGBC'],
    [/sitab|societe ivoirienne des tabacs/, 'STBC'],
    [/saph|plantations d heveas/, 'SPHC'],
    [/sogb|caoutchoucs de grand/, 'SOGC'],
    [/palm\s?ci|palmci/, 'PALC'],
    [/total ci|total cote/, 'TTLC'],
    [/unilever/, 'UNLC'],
    [/nestle/, 'NTLC'],
    [/vivo energy/, 'SHEC'],
    [/filtisac/, 'FTSC'],
    [/sicor/, 'SICC'],
    [/solibra/, 'SLBC'],
    [/setao/, 'STAC'],
    [/ecobank.*ivoire|ecobank ci/, 'ECOC'],
    [/eti|ecobank transnational/, 'ETIT'],
    [/oragroup/, 'ORGT'],
    [/onatel/, 'ONTBF'],
    [/nsia banque/, 'NSBC'],
    [/cfao/, 'CFAC'],
    [/bernabe/, 'BNBC'],
    [/bicici/, 'BICC'],
    [/cie\b|compagnie ivoirienne d electricite/, 'CIEC'],
    [/tractafric/, 'PRSC'],
    [/safca/, 'SAFC'],
    [/smb\b|multinationale de bitumes/, 'SMBC'],
    [/crown siem|emballages metalliques/, 'SEMC'],
    [/servair/, 'ABJC'],
    [/sucrivoire/, 'SCRC'],
  ];

  const codes = new Set(instruments.map((i) => i.code));

  return (name: string): string | null => {
    const norm = normalizeStr(name);
    // 1) alias curés
    for (const [re, code] of CURATED) {
      if (re.test(norm) && codes.has(code)) return code;
    }
    // 2) fuzzy sur la désignation du référentiel
    let best: string | null = null;
    let bestScore = 0;
    for (const ins of instruments) {
      const s = similarity(name, ins.designation ?? ins.code);
      if (s > bestScore) {
        bestScore = s;
        best = ins.code;
      }
    }
    return bestScore >= 0.5 ? best : null;
  };
}

/** Parse la table des dividendes à venir (#tbdDiv). */
function parseUpcoming(
  $: cheerio.CheerioAPI,
  match: (name: string) => string | null,
): { dividends: Dividend[]; unmatched: string[] } {
  const dividends: Dividend[] = [];
  const unmatched: string[] = [];
  $('#tbdDiv tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 3) return;
    const exDate = parseFrDate($(tds[0]).text().trim());
    const name = $(tds[1]).text().trim();
    const montant = parseFrNumber($(tds[2]).text().trim());
    if (!name || montant == null || montant <= 0) return;
    const code = match(name);
    if (!code) {
      unmatched.push(name);
      return;
    }
    // Exercice : un dividende détaché en année N concerne l'exercice N-1.
    const exercice = exDate ? Number(exDate.slice(0, 4)) - 1 : null;
    dividends.push({
      code,
      exercice,
      ex_date: exDate,
      payment_date: null,
      montant,
      devise: 'XOF',
      source: 'sikafinance',
      source_url: SIKA_URL,
    });
  });
  return { dividends, unmatched };
}

/** Parse l'historique pluriannuel (#tblDiv2) : colonnes Div. YYYY / Rend. YYYY. */
function parseHistory(
  $: cheerio.CheerioAPI,
  match: (name: string) => string | null,
): { dividends: Dividend[]; unmatched: string[] } {
  const dividends: Dividend[] = [];
  const unmatched: string[] = [];

  // En-têtes : repérer l'index des colonnes "Div. YYYY" et leur exercice.
  const headerCells = $('#tblDiv2 thead th, #tblDiv2 tr').first().find('th,td');
  const divCols: Array<{ idx: number; exercice: number }> = [];
  headerCells.each((i, th) => {
    const t = $(th).text().trim();
    const m = t.match(/Div\.?\s*(\d{4})/i);
    if (m) divCols.push({ idx: i, exercice: Number(m[1]) });
  });
  if (divCols.length === 0) return { dividends, unmatched };

  $('#tblDiv2 tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length === 0) return;
    const name = $(tds[0]).text().trim();
    if (!name) return;
    const code = match(name);
    if (!code) {
      unmatched.push(name);
      return;
    }
    for (const { idx, exercice } of divCols) {
      const montant = parseFrNumber($(tds[idx]).text().trim());
      if (montant == null || montant <= 0) continue;
      dividends.push({
        code,
        exercice,
        ex_date: null,
        payment_date: null,
        montant,
        devise: 'XOF',
        source: 'sikafinance',
        source_url: SIKA_URL,
      });
    }
  });
  return { dividends, unmatched };
}

/** Récupère et parse les dividendes BRVM depuis sikafinance. */
export async function fetchSikafinanceDividends(): Promise<Dividend[]> {
  const sb = getSupabase();
  const { data: instruments, error } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .eq('actif', true);
  if (error) throw new Error(`load instruments: ${error.message}`);
  const match = buildMatcher((instruments ?? []) as Instrument[]);

  const res = await axios.get<string>(SIKA_URL, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' },
    responseType: 'text',
  });
  const $ = cheerio.load(res.data);

  const up = parseUpcoming($, match);
  const hist = parseHistory($, match);

  const all = [...up.dividends, ...hist.dividends];
  const unmatched = [...new Set([...up.unmatched, ...hist.unmatched])];
  logger.info(
    {
      upcoming: up.dividends.length,
      history: hist.dividends.length,
      total: all.length,
      unmatched,
    },
    'Dividendes sikafinance parsés',
  );
  return all;
}
