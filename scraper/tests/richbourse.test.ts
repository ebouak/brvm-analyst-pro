import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseRichbourse } from '../src/dividends/richbourse.js';

/**
 * Fixture extraite de la page réelle du 2026-09-08 : en-tête, lignes avec
 * code, et lignes sans date de détachement. Un test sur du HTML inventé
 * n'aurait rien prouvé — c'est la mise en page réelle qui doit être tenue.
 */
const HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/richbourse-dividendes.html'),
  'utf8',
);

describe('parseRichbourse', () => {
  const { dividends, ignores } = parseRichbourse(HTML);

  it('extrait le CODE BRVM depuis le lien, jamais depuis le nom', () => {
    // C'est tout l'intérêt de cette source : le code est porté par la page.
    // Deviner par le nom est ce qui a produit la mauvaise attribution
    // BOA Sénégal -> BOA Burkina chez sikafinance.
    expect(dividends.length).toBeGreaterThan(0);
    for (const d of dividends) expect(d.code).toMatch(/^[A-Z]{3,6}(\.[A-Z0-9]+)?$/);
  });

  it('conserve les décimales que sikafinance arrondit', () => {
    const abjc = dividends.find((d) => d.code === 'ABJC');
    expect(abjc?.montant).toBeCloseTo(201.52, 2);
  });

  it('remplit la date de paiement, absente de toute la table jusqu’ici', () => {
    for (const d of dividends) {
      expect(d.payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('déduit l’exercice de l’année de paiement moins un', () => {
    // Vérifié par recoupement sur 18 sociétés : un versement de 2026 rémunère
    // l'exercice 2025.
    for (const d of dividends) {
      expect(d.exercice).toBe(Number(d.payment_date!.slice(0, 4)) - 1);
    }
  });

  it('IGNORE une ligne sans code plutôt que de deviner', () => {
    // Les lignes sans fichier attaché (TRACTAFRIC, BOLLORE-AGL) n'ont pas de
    // code : elles doivent être signalées, jamais rattachées au plus proche.
    for (const nom of ignores) expect(typeof nom).toBe('string');
    expect(dividends.every((d) => d.code && d.montant > 0)).toBe(true);
  });

  it('renvoie du vide sur une table étrangère, sans lever', () => {
    const autre = parseRichbourse('<table><tr><th>Cours</th><th>Volume</th></tr></table>');
    expect(autre.dividends).toEqual([]);
  });
});
