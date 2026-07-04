import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAfxPage, AFX_SOURCES } from '../src/scrapers/africanIndices.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const bySrc = Object.fromEntries(AFX_SOURCES.map((s) => [s.code, s]));

describe('parseAfxPage', () => {
  it('parse la page GSE (Ghana) — valeur, points, % dérivé, YTD, market cap', () => {
    const row = parseAfxPage(fixture('afx-gse.html'), bySrc.GSECI);
    expect(row.code).toBe('GSECI');
    expect(row.place).toBe('Ghana');
    expect(row.date_marche).toBe('2026-07-02');
    expect(row.valeur).toBe(14689.01);
    expect(row.variation_pts).toBe(111.88);
    // % dérivé des points : 111.88 / (14689.01 - 111.88) ≈ 0.77 %
    expect(row.variation_pct).toBeCloseTo(0.77, 2);
    expect(row.ytd_pct).toBe(67.49);
    expect(row.market_cap).toBe('GHS 285.85Bn');
  });

  it('parse la page NGX (Nigeria)', () => {
    const row = parseAfxPage(fixture('afx-ngx.html'), bySrc.NGXASI);
    expect(row.date_marche).toBe('2026-07-03');
    expect(row.valeur).toBe(229240.34);
    expect(row.variation_pts).toBe(4918.37);
    expect(row.variation_pct).toBeCloseTo(2.19, 2);
    expect(row.ytd_pct).toBe(47.31);
    expect(row.market_cap).toBe('NGN 147.11Tr');
  });

  it('parse la page NSE (Kenya)', () => {
    const row = parseAfxPage(fixture('afx-nse.html'), bySrc.NSENASI);
    expect(row.date_marche).toBe('2026-07-03');
    expect(row.valeur).toBe(227.17);
    expect(row.variation_pts).toBe(1.19);
    expect(row.variation_pct).toBeCloseTo(0.53, 2);
    expect(row.ytd_pct).toBe(21.75);
    expect(row.market_cap).toBe('KES 3.85Tr');
  });

  it('rejette une page sans horodatage ni tableau (jamais de données inventées)', () => {
    expect(() => parseAfxPage('<html><body>rien</body></html>', bySrc.GSECI)).toThrow();
    const noTable = '<html><body><time id=u datetime=2026-07-03T10:00:00+00:00>x</time></body></html>';
    expect(() => parseAfxPage(noTable, bySrc.GSECI)).toThrow(/tableau/);
  });

  it('variation manquante → pts/% null, pas 0 (honnêteté des données)', () => {
    const html =
      '<html><body><time id=u datetime=2026-07-03T10:00:00+00:00>x</time>' +
      '<table><thead class=c><tr><th>GSE-CI Index<th>Year-to-Date<th>Market Cap.</thead>' +
      '<tbody class=c><tr><td>14,689.01 <td>+5,918.76 (67.49%)<td>GHS 285.85Bn</tbody></table>' +
      '</body></html>';
    const row = parseAfxPage(html, bySrc.GSECI);
    expect(row.valeur).toBe(14689.01);
    expect(row.variation_pts).toBeNull();
    expect(row.variation_pct).toBeNull();
  });
});
