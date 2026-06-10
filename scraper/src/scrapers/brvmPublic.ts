import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { parseFrNumber, parseFrInt } from '../utils/parseNumber.js';
import type { MarketSnapshot, ActionRow, IndiceRow, MarketSummary, MarketDate } from '../types.js';

/** Libellés d'indices brvm.org -> code interne. */
const INDEX_MAP: Record<string, { code: string; libelle: string }> = {
  'brvm-c': { code: 'BRVMC', libelle: 'BRVM Composite' },
  'brvm-30': { code: 'BRVM30', libelle: 'BRVM 30' },
};

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

  // ── Table « Activités du marché » : indices + totaux de séance ──────────────
  // Sélection par contenu d'en-tête (« activités du marché »), jamais par classe.
  let activity = $();
  $('table').each((_, t) => {
    const head = normHeader($(t).find('thead th, caption').first().text());
    if (head.includes('activites du marche')) { activity = $(t); return false; }
  });
  // Repli : ancienne sélection par classe si le markup change.
  if (activity.length === 0) activity = $('table.activity');

  const indices: IndiceRow[] = [];
  const summary: MarketSummary = {
    valeur_transactions: null,
    capitalisation_actions: null,
    capitalisation_obligations: null,
  };

  activity.find('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;
    const rawLabel = $(tds[0]).text();
    const key = rawLabel.toLowerCase().replace(/\s+/g, '');
    const label = normHeader(rawLabel);

    // Indice connu ?
    const m = INDEX_MAP[key];
    if (m) {
      const valeur = parseFrNumber($(tds[1]).text());
      const variation_pct = tds.length >= 3 ? parseFrNumber($(tds[2]).text()) : null;
      const valeur_precedente =
        valeur != null && variation_pct != null && variation_pct !== -100
          ? Number((valeur / (1 + variation_pct / 100)).toFixed(2))
          : null;
      indices.push({ code: m.code, libelle: m.libelle, valeur, valeur_precedente, variation_pct });
      return;
    }

    // Totaux de séance (FCFA).
    const val = parseFrNumber($(tds[1]).text());
    if (label.includes('valeur des transactions')) summary.valeur_transactions = val;
    else if (label.includes('capitalisation') && label.includes('obligation')) summary.capitalisation_obligations = val;
    else if (label.includes('capitalisation') && label.includes('action')) summary.capitalisation_actions = val;
  });

  const hasSummary =
    summary.valeur_transactions != null ||
    summary.capitalisation_actions != null ||
    summary.capitalisation_obligations != null;

  return {
    date_marche: date,
    actions,
    obligations: [],
    indices,
    summary: hasSummary ? summary : null,
    hash_source: createHash('sha256').update(html).digest('hex'),
    is_mock: false,
  };
}
