import { describe, it, expect } from 'vitest';
import { parseDetails, parseNum } from '../src/scrapers/richbourse-details.js';

/**
 * Balisage relevé sur richbourse le 2026-09-08 (SNTS). Reproduit fidèlement le
 * piège du fichier : la cellule de libellé de « Volume moyen » contient AUSSI
 * une infobulle entière. Une égalité stricte sur le libellé la manquerait, et
 * la colonne resterait vide sans que rien n'échoue.
 */
const TABLE_SOCIETE = `
<table class="table"><tbody>
  <tr><td>Nombre total de titres</td><td style="text-align: right">100 000 000</td></tr>
  <tr><td>Titres du flottant</td><td style="text-align: right">30 510 900</td></tr>
  <tr>
    <td><span class='rb-aide' data-rb-aide-html='#tooltip_content_volume_moyen'>Volume moyen</span>
      <div class='tooltip_templates'><span id='tooltip_content_volume_moyen'>C'est un indicateur qui
      montre la quantité moyenne de titres échangés pendant chaque journée de cotation.</span></div>
    </td>
    <td style="text-align: right">11 058</td>
  </tr>
</tbody></table>`;

const TABLE_SEANCE = `
<table class="table"><tbody>
  <tr><td>Volume (titres)</td><td>22 135</td></tr>
  <tr><td>Ouverture (FCFA)</td><td>38 500</td></tr>
  <tr><td>Plus haut (FCFA)</td><td>39 000</td></tr>
  <tr><td>Plus bas (FCFA)</td><td>38 005</td></tr>
  <tr><td>Clôture jour (FCFA)</td><td>38 700</td></tr>
  <tr><td>Clôture veille (FCFA)</td><td>38 500</td></tr>
</tbody></table>`;

describe('parseNum', () => {
  it('lit les espaces insécables et la virgule décimale', () => {
    expect(parseNum('30 510 900')).toBe(30_510_900);
    expect(parseNum('30\u00a0510\u00a0900')).toBe(30_510_900);
    expect(parseNum('1 707,2')).toBeCloseTo(1707.2, 4);
  });

  it('renvoie null plutôt qu’un NaN déguisé', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum(undefined)).toBeNull();
    expect(parseNum('—')).toBeNull();
  });
});

describe('parseDetails', () => {
  const d = parseDetails('SNTS', TABLE_SOCIETE + TABLE_SEANCE);

  it('lit le volume moyen MALGRÉ l’infobulle dans la cellule de libellé', () => {
    // Le défaut serait muet : colonne vide, aucune erreur, run « réussi ».
    expect(d.vol_moyen).toBe(11_058);
  });

  it('lit le flottant sans le confondre avec le nombre total de titres', () => {
    expect(d.flottant).toBe(30_510_900);
    expect(d.flottant).not.toBe(100_000_000);
  });

  it('distingue clôture du jour et clôture de la veille', () => {
    // Les confondre ferait échouer — ou pire, réussir à tort — la preuve de
    // séance sur laquelle repose l’écriture des extrêmes.
    expect(d.cloture_jour).toBe(38_700);
    expect(d.cloture_veille).toBe(38_500);
  });

  it('lit les extrêmes de séance', () => {
    expect(d.ouverture).toBe(38_500);
    expect(d.plus_haut).toBe(39_000);
    expect(d.plus_bas).toBe(38_005);
  });

  it('renvoie des nulls sur une page sans tableau, sans lever', () => {
    const vide = parseDetails('XXXX', '<html><body><p>rien</p></body></html>');
    expect(vide.flottant).toBeNull();
    expect(vide.vol_moyen).toBeNull();
    expect(vide.cloture_jour).toBeNull();
  });
});
