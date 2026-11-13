import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireCoteBoc, dateSeanceBoc, type ItemPdf } from '../src/boc/cote.js';

/* Extraction réelle du Bulletin Officiel de la Cote du 22/09/2026 (pages 3 et
   4 : tableau des actions). Produite depuis tests/fixtures/boc_20260922.pdf. */
const pages = (JSON.parse(readFileSync(new URL('./fixtures/boc-20260922-cote.json', import.meta.url), 'utf8')) as {
  page: number;
  items: ItemPdf[];
}[]).map((p) => p.items);

const lus = lireCoteBoc(pages);
const de = (code: string) => lus.find((l) => l.code === code);

describe('Bulletin officiel — cote par valeur, par position de colonne', () => {
  it('lit toute la cote des actions, sans doublon', () => {
    expect(lus.length).toBeGreaterThanOrEqual(45);
    expect(new Set(lus.map((l) => l.code)).size).toBe(lus.length);
  });

  it('SNTS : clôture, référence, PER et dernier dividende', () => {
    expect(de('SNTS')).toEqual({
      code: 'SNTS', statut: 'cote', cours_cloture: 41985, cours_reference: 41985, per: 10.15,
      rendement_net_pct: 4.14, dividende_net: 1740, dividende_date: '2026-05-26',
    });
  });

  it('valeur suspendue (« SP ») : statut suspendu, pas de clôture, PER conservé', () => {
    expect(de('SEMC')).toMatchObject({ statut: 'suspendu', cours_cloture: null, cours_reference: 1495, per: 37.21 });
    expect(de('SICC')).toMatchObject({ statut: 'suspendu', cours_cloture: null, cours_reference: 8400, per: null });
  });

  it('sans rendement publié, le PER reste sur SA colonne (SIVC, SAFC)', () => {
    expect(de('SIVC')).toMatchObject({ statut: 'cote', cours_cloture: 2000, per: 97.43, rendement_net_pct: null });
    expect(de('SAFC')).toMatchObject({ cours_cloture: 4300, per: 72.81, rendement_net_pct: null });
  });

  it('page de continuation sans en-tête (ORGT, page 4)', () => {
    expect(de('ORGT')).toMatchObject({ cours_cloture: 3000, cours_reference: 3000, per: 9.62 });
  });

  it('date de séance tirée du pied de page', () => {
    expect(dateSeanceBoc(pages)).toBe('2026-09-22');
  });
});
