/**
 * Scraper des obligations BRVM depuis le portail public brvm.org.
 *
 * Remplace sikafinance, dont la page obligations a été supprimée (404, juin 2026).
 * Source : https://www.brvm.org/fr/cours-obligations/0
 * Colonnes observées : « Code obligation | Nom | Date émission | Date maturité |
 *   Cours du jour en valeur | Coupon couru | Dernier paiement ».
 *
 * Mapping par LIBELLÉ d'en-tête normalisé (jamais par index fixe). Les colonnes
 * absentes côté brvm.org (émetteur, volume, valeur échangée, cours veille) sont
 * laissées à null — le taux nominal est dérivé du nom quand il y figure (« 6,80% »).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { parseFrNumber } from '../utils/parseNumber.js';
import { parseFrDate } from '../utils/dates.js';
import type { ObligationRow } from '../types.js';

const log = logger.child({ module: 'brvmObligations' });
const URL = 'https://www.brvm.org/fr/cours-obligations/0';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; BRVMAnalystPro/1.0)' };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrait le taux nominal (%) depuis la désignation, ex. « 6,80% » → 6.8. */
function tauxFromName(name: string): number | null {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? parseFrNumber(m[1]) : null;
}

/**
 * Dérive la maturité (YYYY-12-31) depuis la désignation quand la colonne
 * brvm.org est vide. Format attendu : « ... 6,80% 2024-2029 » → « 2029-12-31 ».
 * Supprime aussi les préfixes de type obligation (GSS, GENDER BOND, etc.)
 * pour extraire l'émetteur propre.
 */
function parseDesignation(designation: string): { maturite: string | null; emetteur: string | null } {
  const m = designation.match(/(\d{1,2}(?:[.,]\d+)?)\s*%\s*(\d{4})\s*-\s*(\d{4})/);
  if (!m) return { maturite: null, emetteur: null };
  const maturite = `${m[3]}-12-31`;
  const raw = designation.slice(0, m.index ?? 0).replace(/[\s-]+$/, '').trim();
  const emetteur = raw
    .replace(/^(?:GSS|GREEN BOND|GENDER BOND|SOCIAL BOND|CLIMATE BOND|DIASPORA BONDS?)\s+/i, '')
    .trim() || null;
  return { maturite, emetteur };
}

/** Parse le HTML de la page « cours obligations » brvm.org → ObligationRow[]. */
export function parseBrvmObligations(html: string): ObligationRow[] {
  const $ = cheerio.load(html);
  const out: ObligationRow[] = [];
  const seen = new Set<string>();

  $('table').each((_, t) => {
    const headers: string[] = [];
    $(t)
      .find('thead th')
      .each((_, th) => {
        headers.push(norm($(th).text()));
      });
    if (headers.length === 0) {
      // Certaines tables brvm.org portent l'en-tête dans la 1re ligne du tbody.
      $(t)
        .find('tr')
        .first()
        .find('th, td')
        .each((_, th) => {
          headers.push(norm($(th).text()));
        });
    }
    if (headers.length === 0) return;

    const col = (pred: (h: string) => boolean) => headers.findIndex(pred);
    const iCode = col((h) => h.includes('code'));
    const iNom = col((h) => h.includes('nom') || h.includes('designation') || h.includes('libelle'));
    const iMat = col((h) => h.includes('maturite'));
    const iCours = col((h) => h.includes('cours'));
    if (iCode < 0 || iCours < 0) return; // pas la table des obligations

    $(t)
      .find('tbody tr')
      .each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length === 0) return;
        const cell = (i: number) => (i >= 0 && i < tds.length ? $(tds[i]).text().trim() : '');
        const code = cell(iCode);
        if (!code || seen.has(code)) return;
        const designation = cell(iNom) || code;
        seen.add(code);
        // Date maturité : colonne brvm.org présente mais vide → dériver du nom.
        const maturiteFromCol = iMat >= 0 ? parseFrDate(cell(iMat)) : null;
        const parsed = parseDesignation(designation);
        out.push({
          code,
          designation,
          emetteur: parsed.emetteur,
          taux_pct: tauxFromName(designation),
          maturite: maturiteFromCol ?? parsed.maturite,
          cours_precedent: null,
          cours_jour: parseFrNumber(cell(iCours)),
          volume: null,
          valeur_echangee: null,
        });
      });
  });

  return out;
}

/** Récupère et parse les obligations depuis brvm.org. [] si la source échoue. */
export async function fetchBrvmObligations(): Promise<ObligationRow[]> {
  try {
    const res = await axios.get(URL, { headers: H, timeout: 20000 });
    const rows = parseBrvmObligations(res.data as string);
    log.info({ nb: rows.length }, 'Obligations brvm.org parsées');
    return rows;
  } catch (err) {
    log.warn({ err: (err as Error).message, url: URL }, 'Échec fetch obligations brvm.org');
    return [];
  }
}
