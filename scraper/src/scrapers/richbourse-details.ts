/**
 * Détails de cotation richbourse — /common/mouvements/index/<CODE>.
 *
 * DEUX NATURES DE DONNÉES, À NE PAS CONFONDRE.
 *
 *   - `flottant` et `vol_moyen` décrivent la SOCIÉTÉ. Ils ne sont rattachés à
 *     aucune séance : un décalage d'un jour leur est indifférent.
 *   - `ouverture`, `plus_haut`, `plus_bas` décrivent UNE SÉANCE précise. Les
 *     attribuer à la mauvaise séance produit un chiffre faux et plausible.
 *
 * Et le décalage est réel : au 2026-09-08, la clôture affichée par richbourse
 * différait de notre `cours_jour` sur 38 valeurs sur 47 (SNTS 38 700 contre
 * 39 200, NTLC 18 000 contre 16 900) — notre base est rafraîchie en intraday,
 * richbourse a une séance de retard. La page ne porte AUCUNE date de séance
 * exploitable ; l'ancien code se rabattait silencieusement sur « aujourd'hui ».
 *
 * D'où `cloture_jour` et `cloture_veille`, extraits non pour être stockés mais
 * pour SERVIR DE PREUVE : c'est en comparant la clôture de richbourse à la
 * nôtre que `runDetails` établit qu'il s'agit bien de la même séance. Une
 * preuve tirée des données vaut mieux qu'une date devinée.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';
import { RICHBOURSE_AGENT } from '../client/richbourseAgent.js';

export interface RichbourseDetail {
  code: string;
  /** Séance : n'est écrit qu'après preuve de concordance. */
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  /** Preuve de séance, jamais stockée. */
  cloture_jour: number | null;
  cloture_veille: number | null;
  /** Société : indépendant de la séance. */
  flottant: number | null;
  vol_moyen: number | null;
}

const BASE = 'https://www.richbourse.com';

/** « 30 510 900 » ou « 1 707,2 » → nombre. Null si illisible. */
export function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Valeur de la ligne dont la PREMIÈRE cellule contient `label`.
 *
 * La cellule de libellé contient parfois, en plus du titre, une infobulle
 * entière (`<div class='tooltip_templates'>…`) : « Volume moyen » y est suivi
 * d'un paragraphe explicatif. La recherche par inclusion le tolère ; une
 * égalité stricte échouerait.
 */
export function lireLigne($: cheerio.CheerioAPI, label: string): number | null {
  let val: number | null = null;
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;
    if ($(cells[0]).text().trim().toLowerCase().includes(label.toLowerCase())) {
      val = parseNum($(cells[1]).text().trim());
      return false;
    }
  });
  return val;
}

/** PUR : aucune I/O. C'est ici que vit la fragilité au balisage. */
export function parseDetails(code: string, html: string): RichbourseDetail {
  const $ = cheerio.load(html);
  return {
    code,
    ouverture: lireLigne($, 'ouverture'),
    plus_haut: lireLigne($, 'plus haut'),
    plus_bas: lireLigne($, 'plus bas'),
    cloture_jour: lireLigne($, 'clôture jour'),
    cloture_veille: lireLigne($, 'clôture veille'),
    flottant: lireLigne($, 'flottant'),
    vol_moyen: lireLigne($, 'volume moyen'),
  };
}

export async function scrapeDetails(code: string): Promise<RichbourseDetail | null> {
  try {
    const { data: html } = await axios.get<string>(`${BASE}/common/mouvements/index/${code}`, {
      headers: { 'User-Agent': RICHBOURSE_AGENT },
      timeout: 20_000,
      responseType: 'text',
    });
    return parseDetails(code, html);
  } catch (e) {
    logger.warn({ code, err: (e as Error).message }, 'scrapeDetails échoué');
    return null;
  }
}
