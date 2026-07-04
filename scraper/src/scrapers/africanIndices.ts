import * as cheerio from 'cheerio';

/**
 * Parser des pages AFX (afx.kwayisi.org) — indices pan-africains.
 * Structure stable observée (fixtures tests/fixtures/afx-*.html) :
 *   <time id=u datetime=2026-07-02T16:05:51+00:00>…</time>
 *   <table><thead class=c><tr><th>GSE-CI Index<th>Year-to-Date<th>Market Cap.
 *     <tbody class=c><tr><td>14,689.01 <span class=hi>(+111.88)</span>
 *       <td class=hi>+5,918.76 (67.49%)<td>GHS 285.85Bn</table>
 * La variation % du jour est DÉRIVÉE des points (pts / clôture veille) —
 * jamais inventée : null si les points manquent.
 */

export interface AfricanIndexRow {
  code: string;
  libelle: string;
  place: string;
  devise: string | null;
  date_marche: string; // YYYY-MM-DD (jour de la valeur, d'après <time id=u>)
  valeur: number;
  variation_pts: number | null;
  variation_pct: number | null;
  ytd_pct: number | null;
  market_cap: string | null;
  source: string;
}

export interface AfxSource {
  url: string;
  fixture: string;
  code: string;
  libelle: string;
  place: string;
  devise: string;
}

export const AFX_SOURCES: AfxSource[] = [
  { url: 'https://afx.kwayisi.org/gse/', fixture: 'afx-gse.html', code: 'GSECI', libelle: 'GSE Composite (Ghana)', place: 'Ghana', devise: 'GHS' },
  { url: 'https://afx.kwayisi.org/ngx/', fixture: 'afx-ngx.html', code: 'NGXASI', libelle: 'NGX All-Share (Nigeria)', place: 'Nigeria', devise: 'NGN' },
  { url: 'https://afx.kwayisi.org/nse/', fixture: 'afx-nse.html', code: 'NSENASI', libelle: 'NSE All-Share (Kenya)', place: 'Kenya', devise: 'KES' },
];

/** "14,689.01" -> 14689.01 (format anglo : virgule = milliers, point = décimale). */
function parseEnNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s ]/g, '').replace(/[()]/g, '');
  if (cleaned === '' || cleaned === '+' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseAfxPage(html: string, src: Pick<AfxSource, 'code' | 'libelle' | 'place' | 'devise'>): AfricanIndexRow {
  const $ = cheerio.load(html);

  const datetime = $('time#u').attr('datetime') ?? '';
  const dateMarche = /^\d{4}-\d{2}-\d{2}/.test(datetime) ? datetime.slice(0, 10) : null;
  if (!dateMarche) throw new Error(`AFX ${src.code}: horodatage introuvable`);

  // Tableau d'en-tête : thead contenant « Index » + « Year-to-Date ».
  const table = $('table').filter((_, el) => {
    const head = $(el).find('thead').text();
    return /Index/.test(head) && /Year-to-Date/i.test(head);
  }).first();
  if (table.length === 0) throw new Error(`AFX ${src.code}: tableau indice introuvable`);

  const cells = table.find('tbody tr').first().find('td');
  if (cells.length < 2) throw new Error(`AFX ${src.code}: ligne indice incomplète`);

  // td[0] : « 229,240.34 (+4,918.37) » — valeur + variation en points.
  const cell0 = $(cells[0]).text();
  const valMatch = cell0.match(/^\s*([\d,.]+)/);
  const valeur = parseEnNumber(valMatch?.[1]);
  if (valeur == null || valeur <= 0) throw new Error(`AFX ${src.code}: valeur d'indice illisible « ${cell0.trim()} »`);

  const ptsMatch = cell0.match(/\(([+-][\d,.]+)\)/);
  const variationPts = parseEnNumber(ptsMatch?.[1]);

  // % du jour dérivé : pts / clôture veille (= valeur - pts).
  let variationPct: number | null = null;
  if (variationPts != null) {
    const prev = valeur - variationPts;
    if (prev > 0) variationPct = Number(((variationPts / prev) * 100).toFixed(2));
  }

  // td[1] : YTD « +73,627.31 (47.31%) » — on garde le pourcentage.
  const ytdMatch = $(cells[1]).text().match(/\(([-+]?[\d,.]+)%\)/);
  let ytdPct = parseEnNumber(ytdMatch?.[1]);
  // Signe : le montant YTD porte le signe, le % entre parenthèses non.
  if (ytdPct != null && /^\s*-/.test($(cells[1]).text())) ytdPct = -Math.abs(ytdPct);

  const marketCap = cells.length >= 3 ? $(cells[2]).text().trim() || null : null;

  return {
    code: src.code,
    libelle: src.libelle,
    place: src.place,
    devise: src.devise,
    date_marche: dateMarche,
    valeur,
    variation_pts: variationPts,
    variation_pct: variationPct,
    ytd_pct: ytdPct,
    market_cap: marketCap,
    source: 'afx.kwayisi.org',
  };
}
