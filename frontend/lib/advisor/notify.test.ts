import { describe, it, expect } from 'vitest';
import { formatFlipText, formatFlipHtml, type AdvisorFlip } from './notify';

const flips: AdvisorFlip[] = [
  { code: 'SNTS', from: 'conserver', to: 'acheter', conviction: 72 },
  { code: 'BOAB', from: 'acheter', to: 'vendre', conviction: 55 },
];

describe('formatFlipText', () => {
  it('liste chaque bascule avec verbe lisible et conviction', () => {
    const t = formatFlipText(flips, '2026-06-20');
    expect(t).toContain('2 changement(s)');
    expect(t).toContain('SNTS : Conserver → Acheter (conviction 72%)');
    expect(t).toContain('BOAB : Acheter → Vendre (conviction 55%)');
  });

  it('tronque au-delà de 20 et indique le reste', () => {
    const many: AdvisorFlip[] = Array.from({ length: 25 }, (_, i) => ({
      code: `C${i}`, from: 'conserver', to: 'acheter', conviction: 50,
    }));
    expect(formatFlipText(many, '2026-06-20')).toContain('… et 5 autre(s).');
  });
});

describe('formatFlipHtml', () => {
  it('produit une ligne de tableau par bascule', () => {
    const h = formatFlipHtml(flips, '2026-06-20');
    expect(h).toContain('SNTS');
    expect(h).toContain('Conserver → <b>Acheter</b>');
    expect(h).toContain('72%');
  });
});
