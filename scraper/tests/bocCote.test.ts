import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireCoteBoc, dateSeanceBoc, referencePlausible, type ItemPdf } from '../src/boc/cote.js';

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

/* Ligne SIVC du bulletin du 12/11/2026, positions telles qu'extraites du PDF :
   la valeur échangée « 927 230 » (x=338) commence dans la fenêtre de la
   référence. Le lecteur prenait ce nombre comme cours de référence. */
describe('référence : la valeur échangée longue ne la remplace pas', () => {
  const y = 500;
  const it_ = (s: string, x: number): ItemPdf => ({ s, x, y } as ItemPdf);
  const page: ItemPdf[] = [
    it_('Clôt.', 219), it_('Variation', 245), it_('Référence', 352), it_('Variation de', 397), it_('PER', 561),
    it_('SIVC', 38), it_('ERIUM CI (Ex AIR LIQUIDE', 68), it_('1 750', 174), it_('1 750', 202), it_('1 700', 230),
    it_('-2,86 %', 260), it_('538', 306), it_('927 230', 338), it_('1 700', 382), it_('7,59 %', 430),
    it_('63', 482), it_('29-sept.-17', 493), it_('82,81', 564),
  ].map((i) => ({ ...i, y: i.s === 'Clôt.' || i.s === 'Variation' || i.s === 'Référence' || i.s === 'Variation de' || i.s === 'PER' ? 100 : y }));

  it('SIVC 12/11 : référence 1 700, pas 927 230', () => {
    expect(lireCoteBoc([page]).find((l) => l.code === 'SIVC')).toMatchObject({ cours_cloture: 1700, cours_reference: 1700, per: 82.81 });
  });
  it('une référence invraisemblable face à la clôture est écartée', () => {
    expect(referencePlausible(927230, 1700)).toBeNull();
    expect(referencePlausible(1650, 1700)).toBe(1650);
    expect(referencePlausible(1495, null)).toBe(1495); // valeur suspendue : rien à comparer
  });
});
