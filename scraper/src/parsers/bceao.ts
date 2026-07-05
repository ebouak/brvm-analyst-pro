import * as cheerio from 'cheerio';

/**
 * Parser des taux directeurs BCEAO (page d'accueil bceao.int, bloc
 * #blocktabs-home--9 « Taux directeurs »). Structure observée (fixture
 * tests/fixtures/bceao-home.html) :
 *   <li>Taux minimum de soumission : 3,00 %</li>
 *   <li>Taux du guichet de prêt marginal: 5,00 %</li>
 *   <p class="pttTxt"><strong>Effectifs depuis le 16 mars 2026</strong></p>
 * Mapping par libellé (jamais par index) — si un libellé change, la valeur
 * associée devient null plutôt que d'être mal assignée.
 */

export interface BceaoRates {
  tauxDirecteur: number | null;
  guichetMarginal: number | null;
  /** Date d'effet au format YYYY-MM-DD, ou null si non trouvée/non parsable. */
  effectifDepuis: string | null;
}

const MOIS_FR: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', aout: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
};

/** Parse "16 mars 2026" → "2026-03-16". Null si format non reconnu. */
export function parseDateFr(texte: string): string | null {
  const m = texte.match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const mois = MOIS_FR[m[2].toLowerCase()];
  if (!mois) return null;
  return `${m[3]}-${mois}-${m[1].padStart(2, '0')}`;
}

/** Convertit "3,00 %" / "3.00%" en 3.00. Null si aucun nombre trouvé. */
function parsePercent(texte: string): number | null {
  const m = texte.match(/([\d]+(?:[.,]\d+)?)\s*%/);
  if (!m || !m[1]) return null;
  return parseFloat(m[1].replace(',', '.'));
}

export function parseBceaoRates(html: string): BceaoRates {
  const $ = cheerio.load(html);
  let tauxDirecteur: number | null = null;
  let guichetMarginal: number | null = null;

  $('li').each((_, el) => {
    const t = $(el).text().trim();
    const norm = t.toLowerCase();
    if (norm.includes('minimum de soumission')) {
      tauxDirecteur = parsePercent(t);
    } else if (norm.includes('guichet') && norm.includes('marginal')) {
      guichetMarginal = parsePercent(t);
    }
  });

  let effectifDepuis: string | null = null;
  $('.pttTxt, p').each((_, el) => {
    const t = $(el).text();
    if (/effectif/i.test(t)) {
      const d = parseDateFr(t);
      if (d) {
        effectifDepuis = d;
        return false;
      }
    }
    return undefined;
  });

  return { tauxDirecteur, guichetMarginal, effectifDepuis };
}
