import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseSikaSociete } from '../src/dividends/sikaSociete.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (n: string) => readFileSync(join(here, 'fixtures', n), 'utf8');

describe('parseSikaSociete', () => {
  it('extrait les 5 exercices de dividendes (BOAC)', () => {
    const d = parseSikaSociete(fixture('sika-societe-boac.html'));
    expect(d).toEqual([
      { exercice: 2021, montant: 187 },
      { exercice: 2022, montant: 270 },
      { exercice: 2023, montant: 342 },
      { exercice: 2024, montant: 459 },
      { exercice: 2025, montant: 594.5 },
    ]);
  });

  it('« - » = AUCUN dividende distribué (fait), pas une donnée manquante (NSBC)', () => {
    // Confondre les deux fausserait tout : traiter un vrai zéro comme « inconnu »
    // exclurait le titre à tort ; traiter un trou comme un zéro sous-estimerait
    // son rendement.
    const d = parseSikaSociete(fixture('sika-societe-nsbc.html'));
    const y2021 = d.find((x) => x.exercice === 2021);
    expect(y2021).toEqual({ exercice: 2021, montant: 0 });
    expect(d.find((x) => x.exercice === 2022)?.montant).toBe(363.86);
  });

  it('page sans tableau de dividendes : tableau vide, jamais des zéros inventés', () => {
    expect(parseSikaSociete('<html><body><p>rien</p></body></html>')).toEqual([]);
    expect(parseSikaSociete('')).toEqual([]);
  });

  it('résiste à un HTML malformé', () => {
    expect(() => parseSikaSociete('<table><tr><td>Dividende</td>')).not.toThrow();
  });

  it('ne confond pas le montant avec l’année (le bug historique)', () => {
    // L'ancien parser lisait « Dividende 2012 » et retenait 2012 COMME MONTANT.
    // 90 lignes de la base étaient ainsi du pur bruit.
    const d = parseSikaSociete(fixture('sika-societe-boac.html'));
    for (const x of d) {
      expect(x.montant).not.toBe(x.exercice);
    }
  });
});
