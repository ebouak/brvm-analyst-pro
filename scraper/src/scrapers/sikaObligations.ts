/**
 * Scraper des obligations BRVM depuis sikafinance.com.
 *
 * Source calibrée : https://www.sikafinance.com/marches/obligations-taux-fixes
 * Structure (tableau HTML) :
 *   Colonne : Code / Désignation / Emetteur / Taux / Maturité / Cours veille
 *             / Cours jour / Volume / Valeur échangée
 *
 * Alternative : `/marches/obligations-taux-variables`
 *
 * Le parser tente les deux pages et fusionne (dedupe par code).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { parseFrNumber, parseFrInt, cleanText } from '../utils/parseNumber.js';
import { parseFrDate } from '../utils/dates.js';
import type { ObligationRow } from '../types.js';

const log = logger.child({ module: 'sikaObligations' });
const BASE = 'https://www.sikafinance.com';
const URLS = [
  `${BASE}/marches/obligations-taux-fixes`,
  `${BASE}/marches/obligations-taux-variables`,
];
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };

// Mapping simplifié colonne → champs cibles
const HEADER_MAP: Record<string, string> = {
  code:            'code',
  designation:     'designation',
  emetteur:        'emetteur',
  taux:            'taux_pct',
  maturite:        'maturite',
  'cours veille':  'cours_precedent',
  'cours jour':    'cours_jour',
  'cours actuel':  'cours_jour',
  volume:          'volume',
  'valeur echangee': 'valeur_echangee',
  capitaux:        'valeur_echangee',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function parseObligationsPage(html: string, source: string): ObligationRow[] {
  const $ = cheerio.load(html);
  const out: ObligationRow[] = [];

  // Chercher le premier <table> avec au moins un "taux" dans les en-têtes
  $('table').each((_, tbl) => {
    const headers: string[] = [];
    $(tbl).find('thead th, tr:first-child th, tr:first-child td').each((_, th) => {
      headers.push(normalizeHeader($(th).text()));
    });

    if (!headers.some((h) => h.includes('taux') || h.includes('obligation'))) return;

    // Construire index des colonnes
    const colIdx: Record<string, number> = {};
    for (const [hdr, field] of Object.entries(HEADER_MAP)) {
      const idx = headers.findIndex((h) => h.includes(hdr));
      if (idx >= 0) colIdx[field] = idx;
    }

    // Parser les lignes de données
    $(tbl).find('tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 3) return;

      const get = (field: string): string =>
        colIdx[field] != null ? cleanText($(tds[colIdx[field]!]).text()) : '';

      const code = get('code');
      const designation = get('designation');
      if (!code && !designation) return;

      const row: ObligationRow = {
        code: code || designation.slice(0, 16).toUpperCase().replace(/\s+/g, '-'),
        designation: designation || code,
        emetteur: get('emetteur') || null,
        taux_pct: parseFrNumber(get('taux_pct')),
        maturite: parseFrDate(get('maturite')),
        cours_precedent: parseFrNumber(get('cours_precedent')),
        cours_jour: parseFrNumber(get('cours_jour')),
        volume: parseFrInt(get('volume')),
        valeur_echangee: parseFrNumber(get('valeur_echangee')),
      };
      out.push(row);
    });

    return false; // stopper dès le premier tableau valide
  });

  log.info({ count: out.length, source }, 'Obligations Sika parsées');
  return out;
}

/** Scrape les deux pages obligations Sika et fusionne. */
export async function fetchSikaObligations(): Promise<ObligationRow[]> {
  const all: ObligationRow[] = [];
  const seen = new Set<string>();

  for (const url of URLS) {
    try {
      const res = await axios.get<string>(url, {
        timeout: 25000,
        headers: H,
        responseType: 'text',
      });
      const rows = parseObligationsPage(res.data, url);
      for (const r of rows) {
        if (!seen.has(r.code)) {
          seen.add(r.code);
          all.push(r);
        }
      }
    } catch (err) {
      log.warn({ url, err: err instanceof Error ? err.message : String(err) }, 'Échec fetch obligations Sika');
    }
  }

  log.info({ total: all.length }, 'Obligations Sika — total fusionné');
  return all;
}
