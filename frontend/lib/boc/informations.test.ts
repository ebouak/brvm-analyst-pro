import { describe, expect, it } from 'vitest';
import { derniersAvis, operationsEnCours, type BocAvis, type BocOperation } from './informations';

const op = (p: Partial<BocOperation>): BocOperation => ({
  emetteur: 'VIVO ENERGY CI', code: 'SHEC', operation: 'Paiement de dividendes', type_operation: 'dividende',
  date_operation: '2026-09-25', premier_bulletin: '2026-09-15', dernier_bulletin: '2026-09-22', ...p,
});
const av = (p: Partial<BocAvis>): BocAvis => ({
  categorie: 'avis', entite: 'BRVM', code: null, numero: '277-2026', nature: 'X', objet: 'Y', date_bulletin: '2026-09-22', ...p,
});

describe('informations du Bulletin officiel', () => {
  it('une opération absente du dernier bulletin n’est plus « en cours »', () => {
    const r = operationsEnCours([
      op({ date_operation: '2026-09-30' }),
      op({ date_operation: null }),
      op({ date_operation: '2026-09-25' }),
      op({ dernier_bulletin: '2026-09-10' }),
    ], '2026-09-22');
    expect(r.map((o) => o.date_operation)).toEqual(['2026-09-25', '2026-09-30', null]);
    expect(operationsEnCours([op({})], null)).toEqual([]);
  });

  it('avis du plus récent au plus ancien, bornés', () => {
    const r = derniersAvis([
      av({ numero: '277-2026' }), av({ numero: '280-2026' }), av({ numero: '200-2026', date_bulletin: '2026-08-01' }),
    ], 2);
    expect(r.map((a) => a.numero)).toEqual(['280-2026', '277-2026']);
  });
});
