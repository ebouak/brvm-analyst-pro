import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { controlerRendement, lireDerniersDividendes, separerIncoherents, type ItemPdf } from '../src/dividends/boc.js';

/* Extraction réelle du Bulletin Officiel de la Cote du 09/10/2026 (pages 3 et
   4 : tableau des actions, colonnes « Dernier dividende | Date | Rdt. Net »).
   La page 4 ne répète pas les en-têtes : ses colonnes se lisent avec celles
   de la page 3. */
const pages = (JSON.parse(readFileSync(new URL('./fixtures/boc-20261009-dividendes.json', import.meta.url), 'utf8')) as {
  page: number;
  items: ItemPdf[];
}[]).map((p) => p.items);

const lus = lireDerniersDividendes(pages);
const de = (code: string) => lus.find((d) => d.code === code);

describe('Bulletin officiel — dernier dividende payé, par position de colonne', () => {
  it('SNTS : 1 740 (net) payé le 26/05/2026, rendement net 3,87 %', () => {
    expect(de('SNTS')).toEqual({ code: 'SNTS', montant: 1740, date_paiement: '2026-05-26', rendement_net_pct: 3.87, cours_reference: 44980 });
  });

  it('montants à décimales et mois abrégés (août, sept.)', () => {
    expect(de('SGBC')).toMatchObject({ montant: 2298.75, date_paiement: '2026-08-24' });
    expect(de('PRSC')).toMatchObject({ montant: 182.16, date_paiement: '2025-09-30' });
  });

  it('un dividende ancien reste sur SA ligne, sans rendement (UNLC : payé en 2012)', () => {
    expect(de('UNLC')).toEqual({ code: 'UNLC', montant: 1233, date_paiement: '2012-07-09', rendement_net_pct: null, cours_reference: 48000 });
  });

  it('page sans en-tête : colonnes reprises de la page précédente (ORGT, page 4)', () => {
    expect(de('ORGT')).toMatchObject({ montant: 59.52, date_paiement: '2020-07-17' });
  });

  it('aucune ligne inventée : un code lu = une ligne du bulletin', () => {
    expect(lus.map((d) => d.code).sort()).toEqual(['BOAB', 'ORGT', 'PRSC', 'SGBC', 'SNTS', 'UNLC']);
  });

  it('toutes les lignes de l’extrait sont cohérentes : montant ÷ référence = rendement publié', () => {
    expect(separerIncoherents(lus).rejets).toEqual([]);
  });
});

/* Ligne FTSC RÉELLE du bulletin du 09/10/2026 (page 3, extraction pdfjs), avec
   les en-têtes de la même page : 1 726,56 ÷ 1 870 (référence) = 92,33 %, le
   rendement publié. Distribution exceptionnelle (AG du 23/05/2025), payée le
   30/09/2025 : un montant hors norme mais une lecture JUSTE, qui doit passer. */
const ENTETES_P3: ItemPdf[] = [
  { s: 'Symbole', x: 42, y: 753 }, { s: 'Clôt.', x: 222, y: 745 }, { s: 'Variation', x: 246, y: 756 },
  { s: 'Référence', x: 359, y: 748 }, { s: 'Variation de', x: 399, y: 761 }, { s: 'Dernier dividende', x: 454, y: 761 },
  { s: 'Date', x: 498, y: 745 }, { s: 'Rdt. Net', x: 525, y: 753 }, { s: 'PER', x: 561, y: 761 },
];
const FTSC: ItemPdf[] = [
  { s: 'FTSC', x: 38, y: 716 }, { s: 'FILTISAC CI', x: 68, y: 716 }, { s: '1 870', x: 174, y: 716 }, { s: '1 865', x: 202, y: 716 },
  { s: '1 870', x: 230, y: 716 }, { s: '0,00 %', x: 263, y: 716 }, { s: '5 838', x: 301, y: 716 }, { s: '10 906 680', x: 330, y: 716 },
  { s: '1 870', x: 382, y: 716 }, { s: '-15,77 %', x: 425, y: 716 }, { s: '1726,56', x: 467, y: 716 }, { s: '30-sept.-25', x: 493, y: 716 },
  { s: '92,33 %', x: 536, y: 716 }, { s: '56,60', x: 564, y: 716 },
];

describe('Bulletin officiel — contrôle de cohérence du rendement', () => {
  it('FTSC (bulletin réel du 09/10/2026) : 1 726,56 ÷ 1 870 = 92,33 %, la ligne PASSE', () => {
    const [ftsc] = lireDerniersDividendes([[...ENTETES_P3, ...FTSC]]);
    expect(ftsc).toEqual({ code: 'FTSC', montant: 1726.56, date_paiement: '2025-09-30', rendement_net_pct: 92.33, cours_reference: 1870 });
    expect(controlerRendement(ftsc!)).toBeNull();
    expect(separerIncoherents([ftsc!]).retenus).toHaveLength(1);
  });

  it('colonnes inversées (référence lue comme dividende, et l’inverse) : la ligne est REJETÉE et nommée', () => {
    // Cas fabriqué : les cellules « 1 870 » et « 1726,56 » échangent leurs positions.
    const inverse = FTSC.map((i) => (i.x === 382 ? { ...i, s: '1726,56' } : i.x === 467 ? { ...i, s: '1 870' } : i));
    const [lu] = lireDerniersDividendes([[...ENTETES_P3, ...inverse]]);
    expect(lu).toMatchObject({ code: 'FTSC', montant: 1870, cours_reference: 1726.56, rendement_net_pct: 92.33 });
    const { retenus, rejets } = separerIncoherents([lu!]);
    expect(retenus).toEqual([]);
    expect(rejets).toHaveLength(1);
    expect(rejets[0]!.code).toBe('FTSC');
    expect(rejets[0]!.motif).toContain('108.31 %');
  });

  it('tolérance de 0,5 point ; sans rendement publié ou sans référence, rien à recouper (pas de régression)', () => {
    const base = { code: 'XXXX', montant: 100, date_paiement: '2026-06-01', rendement_net_pct: 5, cours_reference: 2000 };
    expect(controlerRendement(base)).toBeNull(); // 5,00 % exact
    expect(controlerRendement({ ...base, rendement_net_pct: 5.49 })).toBeNull();
    expect(controlerRendement({ ...base, rendement_net_pct: 5.6 })).not.toBeNull();
    expect(controlerRendement({ ...base, rendement_net_pct: null })).toBeNull();
    expect(controlerRendement({ ...base, cours_reference: null })).toBeNull();
  });
});

import { classer } from '../src/dividends/runDividendesBoc.js';
import { sansEcraserReference, SOURCES_REFERENCE } from '../src/dividends/runDividends.js';

describe('rapprochement avec la base', () => {
  const boc = { code: 'SNTS', montant: 1740, date_paiement: '2026-05-26', rendement_net_pct: 3.87 };
  const jour = new Date('2026-10-11T12:00:00Z');
  it('montant différent (SNTS : 1 750 en base, 1 740 au bulletin)', () => {
    expect(classer(boc, { montant: 1750, payment_date: null, source: 'BRVM', base_fiscale: 'inconnu' }, jour)).toBe('montant_different');
  });
  it('même montant sans date de paiement → date_manquante ; tout pareil → concordant', () => {
    expect(classer(boc, { montant: 1740, payment_date: null, source: 's', base_fiscale: null }, jour)).toBe('date_manquante');
    expect(classer(boc, { montant: 1740, payment_date: '2026-05-26', source: 's', base_fiscale: null }, jour)).toBe('concordant');
  });
  it('absent de la base : inscrit s’il a moins de trois ans, sinon « ancien » (jamais base de rendement)', () => {
    expect(classer(boc, null, jour)).toBe('absent');
    expect(classer({ ...boc, date_paiement: '2012-07-09' }, null, jour)).toBe('ancien');
  });
  it('une ligne du calendrier officiel n’est jamais réécrite par le Bulletin', () => {
    expect(classer(boc, { montant: 1750, payment_date: null, source: 'brvm-calendrier', base_fiscale: 'net' }, jour)).toBe('calendrier');
  });
});

describe('priorité des sources', () => {
  it('une ligne du Bulletin officiel n’est écrasée par aucune autre source', () => {
    const lot = [
      { code: 'SGBC', exercice: 2025, montant: 2293.28, source: 'richbourse' },
      { code: 'SHEC', exercice: 2025, montant: 85.07, source: 'richbourse' },
      { code: 'NEIC', exercice: null, montant: 10, source: 'BRVM' },
    ];
    const gardes = sansEcraserReference(lot, new Set(['SGBC|2025']));
    expect(gardes.map((r) => r.code)).toEqual(['SHEC', 'NEIC']);
  });
  it('le calendrier et le Bulletin sont les deux sources de référence, le calendrier d’abord', () => {
    expect(SOURCES_REFERENCE).toEqual(['brvm-calendrier', 'brvm-boc']);
  });
});
