import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { parseFrNumber, parseFrInt } from '../utils/parseNumber.js';
import type { MarketSnapshot, ActionRow, MarketDate } from '../types.js';

/** Normalise un libellé d'en-tête (minuscule, sans accents ni parenthèses). */
function normHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse la page publique brvm.org (tableau « Activités du marché ») en MarketSnapshot.
 * Mapping par libellé de colonne (jamais par index). cours_jour = Cours Clôture.
 */
export function parseBrvmPublic(html: string, date: MarketDate): MarketSnapshot {
  const $ = cheerio.load(html);
  const actions: ActionRow[] = [];

  // Sélectionne la table des cours par le contenu de ses en-têtes (« Symbole » + « Cours »),
  // jamais par classe (plusieurs tables partagent les mêmes classes Bootstrap).
  let table = $();
  $('table').each((_, t) => {
    const heads = $(t).find('thead th').map((_, th) => normHeader($(th).text())).get();
    if (heads.some((h) => h.includes('symbole')) && heads.some((h) => h.includes('cours veille'))) {
      table = $(t);
      return false;
    }
  });

  if (table.length > 0) {
    const headers: string[] = [];
    table.find('thead th').each((_, th) => {
      headers.push(normHeader($(th).text()));
    });
    const col = (label: string) => headers.findIndex((h) => h.includes(label));
    const iSym = col('symbole');
    const iNom = col('nom');
    const iVol = col('volume');
    const iVeille = col('cours veille');
    const iCloture = col('cours cloture');
    const iVar = col('variation');

    table.find('tbody tr').each((_, tr) => {
      const tds = $(tr).find('td');
      const cell = (i: number) => (i >= 0 && i < tds.length ? $(tds[i]).text().trim() : '');
      const code = cell(iSym).toUpperCase();
      if (!code) return;
      actions.push({
        code,
        designation: cell(iNom),
        pays: null,
        secteur: null,
        cours_precedent: parseFrNumber(cell(iVeille)),
        cours_jour: parseFrNumber(cell(iCloture)),
        variation_pct: parseFrNumber(cell(iVar)),
        volume: parseFrInt(cell(iVol)),
        nb_transactions: null,
        valeur_echangee: null,
      });
    });
  }

  return {
    date_marche: date,
    actions,
    obligations: [],
    indices: [],
    hash_source: createHash('sha256').update(html).digest('hex'),
    is_mock: false,
  };
}
