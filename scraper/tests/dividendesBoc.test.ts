import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireDerniersDividendes, type ItemPdf } from '../src/dividends/boc.js';

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
    expect(de('SNTS')).toEqual({ code: 'SNTS', montant: 1740, date_paiement: '2026-05-26', rendement_net_pct: 3.87 });
  });

  it('montants à décimales et mois abrégés (août, sept.)', () => {
    expect(de('SGBC')).toMatchObject({ montant: 2298.75, date_paiement: '2026-08-24' });
    expect(de('PRSC')).toMatchObject({ montant: 182.16, date_paiement: '2025-09-30' });
  });

  it('un dividende ancien reste sur SA ligne, sans rendement (UNLC : payé en 2012)', () => {
    expect(de('UNLC')).toEqual({ code: 'UNLC', montant: 1233, date_paiement: '2012-07-09', rendement_net_pct: null });
  });

  it('page sans en-tête : colonnes reprises de la page précédente (ORGT, page 4)', () => {
    expect(de('ORGT')).toMatchObject({ montant: 59.52, date_paiement: '2020-07-17' });
  });

  it('aucune ligne inventée : un code lu = une ligne du bulletin', () => {
    expect(lus.map((d) => d.code).sort()).toEqual(['BOAB', 'ORGT', 'PRSC', 'SGBC', 'SNTS', 'UNLC']);
  });
});

import { classer } from '../src/dividends/runDividendesBoc.js';
import { sansEcraserReference } from '../src/dividends/runDividends.js';

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
});
