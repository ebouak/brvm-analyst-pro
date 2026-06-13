import { describe, it, expect } from 'vitest';
import { parseCapitalisations } from '../src/shares/brvmCapitalisations.js';

// Fixture minimale reproduisant la table « capitalisations » de brvm.org :
// colonne 0 = code, colonne « Nombre de titres » = nombre d'actions.
const HTML = `
<table>
  <tr><th>Code obligation</th><th>Nom</th><th>Nombre de titres</th><th>Cours du jour</th><th>Capitalisation globale</th></tr>
  <tbody>
    <tr><td>ABJC</td><td>SERVAIR ABIDJAN</td><td>10 912 000</td><td>3 350</td><td>36 555 200 000</td></tr>
    <tr><td>PALC</td><td>PALM CI</td><td>20 406 297</td><td>9 000</td><td>183 656 673 000</td></tr>
    <tr><td>BADWORD</td><td>Sans titres</td><td></td><td>0</td><td>0</td></tr>
  </tbody>
</table>`;

describe('parseCapitalisations (brvm.org)', () => {
  it('extrait le nombre de titres par code', () => {
    const rows = parseCapitalisations(HTML);
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r.shares]));
    expect(byCode.ABJC).toBe(10_912_000);
    expect(byCode.PALC).toBe(20_406_297);
    expect(rows.every((r) => r.source === 'brvm.org')).toBe(true);
  });

  it('ignore les lignes sans nombre de titres', () => {
    const rows = parseCapitalisations(HTML);
    expect(rows.find((r) => r.code === 'BADWORD')).toBeUndefined();
  });

  it('renvoie vide si aucune table « nombre de titres »', () => {
    expect(parseCapitalisations('<table><tr><th>Nom</th><th>Cours</th></tr></table>')).toEqual([]);
  });
});
