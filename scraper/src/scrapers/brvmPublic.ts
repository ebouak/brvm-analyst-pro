import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { parseFrNumber, parseFrInt } from '../utils/parseNumber.js';
import type { MarketSnapshot, ActionRow, IndiceRow, MarketSummary, MarketDate } from '../types.js';

/** Libellés d'indices brvm.org -> code interne (table « Activités du marché »). */
const INDEX_MAP: Record<string, { code: string; libelle: string }> = {
  'brvm-c': { code: 'BRVMC', libelle: 'BRVM Composite' },
  'brvm-30': { code: 'BRVM30', libelle: 'BRVM 30' },
};

/**
 * Indices de la page « Résumé » (https://www.brvm.org/fr/resume) — tableaux
 * « Indices » (4 principaux) + « Indices sectoriels » (7).
 * Mapping par NOM normalisé (cf. normName) -> code interne stable.
 *
 * Codes internes :
 *   BRVMC      BRVM Composite              | BRVM30     BRVM 30
 *   BRVMPRES   BRVM Prestige               | BRVMPRIN   BRVM Principal
 *   BRVMCBASE  Consommation de base        | BRVMCDISC  Consommation discrétionnaire
 *   BRVMENER   Énergie                     | BRVMINDU   Industriels
 *   BRVMFINS   Services financiers         | BRVMSPUB   Services publics
 *   BRVMTELE   Télécommunications
 */
// Clés = sortie de normName() (préfixe « brvm - » retiré) : « BRVM - COMPOSITE »
// -> « composite », « BRVM-30 » -> « 30 », « BRVM - PRESTIGE » -> « prestige ».
const RESUME_INDEX_MAP: Record<string, { code: string; libelle: string }> = {
  composite: { code: 'BRVMC', libelle: 'BRVM Composite' },
  '30': { code: 'BRVM30', libelle: 'BRVM 30' },
  prestige: { code: 'BRVMPRES', libelle: 'BRVM Prestige' },
  principal: { code: 'BRVMPRIN', libelle: 'BRVM Principal' },
  'consommation de base': { code: 'BRVMCBASE', libelle: 'BRVM - Consommation de base' },
  'consommation discretionnaire': { code: 'BRVMCDISC', libelle: 'BRVM - Consommation discrétionnaire' },
  energie: { code: 'BRVMENER', libelle: 'BRVM - Énergie' },
  industriels: { code: 'BRVMINDU', libelle: 'BRVM - Industriels' },
  'services financiers': { code: 'BRVMFINS', libelle: 'BRVM - Services financiers' },
  'services publics': { code: 'BRVMSPUB', libelle: 'BRVM - Services publics' },
  telecommunications: { code: 'BRVMTELE', libelle: 'BRVM - Télécommunications' },
};

/**
 * Normalise un NOM d'indice de la page « Résumé » : minuscule, sans accents,
 * sans parenthèses, et on retire un préfixe « brvm - » éventuel des sectoriels
 * (« BRVM - Énergie » -> « energie ») pour la correspondance dans RESUME_INDEX_MAP.
 */
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^brvm\s*[-–]\s*/, '');
}

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

/**
 * Parse la page publique « Résumé » brvm.org (tableaux « Indices » + « Indices
 * sectoriels ») et retourne les 11 indices (4 principaux + 7 sectoriels).
 *
 * Mapping des colonnes par LIBELLÉ d'en-tête normalisé (jamais par index) :
 * colonnes attendues « Nom | Fermeture précédente | Fermeture | Variation (%)
 * | Variation 31 décembre (%) ». La colonne « Variation 31 décembre » (YTD)
 * est ignorée (pas de colonne dédiée dans brvm_indices_daily — YAGNI).
 *
 * Les lignes inconnues (non présentes dans RESUME_INDEX_MAP) sont ignorées.
 */
export function parseBrvmResumeIndices(html: string): IndiceRow[] {
  const $ = cheerio.load(html);
  const out: IndiceRow[] = [];
  const seen = new Set<string>();

  // Repère toute table dont l'en-tête contient « nom » + « fermeture »
  // (les deux tables « Indices » et « Indices sectoriels » partagent ce schéma).
  $('table').each((_, t) => {
    const headers: string[] = [];
    $(t)
      .find('thead th')
      .each((_, th) => {
        headers.push(normHeader($(th).text()));
      });
    if (headers.length === 0) return;

    const hasNom = headers.some((h) => h.includes('nom'));
    const hasFermeture = headers.some((h) => h.includes('fermeture'));
    if (!hasNom || !hasFermeture) return;

    const col = (pred: (h: string) => boolean) => headers.findIndex(pred);
    const iNom = col((h) => h.includes('nom'));
    // « Fermeture précédente » = veille ; « Fermeture » (sans « precedente ») = valeur du jour.
    const iPrec = col((h) => h.includes('fermeture') && h.includes('precedente'));
    const iFerm = col((h) => h.includes('fermeture') && !h.includes('precedente'));
    // « Variation (%) » du jour, en excluant « Variation 31 décembre » (YTD).
    const iVar = col((h) => h.includes('variation') && !h.includes('decembre') && !h.includes('31'));

    $(t)
      .find('tbody tr')
      .each((_, tr) => {
        const tds = $(tr).find('td');
        const cell = (i: number) => (i >= 0 && i < tds.length ? $(tds[i]).text().trim() : '');
        const rawName = cell(iNom);
        if (!rawName) return;
        const m = RESUME_INDEX_MAP[normName(rawName)];
        if (!m || seen.has(m.code)) return;
        seen.add(m.code);
        out.push({
          code: m.code,
          libelle: m.libelle,
          valeur: parseFrNumber(cell(iFerm)),
          valeur_precedente: parseFrNumber(cell(iPrec)),
          variation_pct: parseFrNumber(cell(iVar)),
        });
      });
  });

  return out;
}
