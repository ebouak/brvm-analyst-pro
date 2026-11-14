import { describe, it, expect } from 'vitest';
import { revuesMisesAJour } from '../src/dossiers/revues.js';

const detenues = [
  { code: 'SNTS', designation: 'SONATEL' },
  { code: 'NEIC', designation: 'NEI CEDA CI' },
  { code: 'SGBC', designation: 'SOCIETE GENERALE CI' },
];

describe('revuesMisesAJour', () => {
  it('ne retient que les valeurs détenues ayant une publication récente, dans l’ordre du portefeuille', () => {
    const r = revuesMisesAJour(detenues, [
      { code: 'SGBC', date_evenement: '2026-11-05' },
      { code: 'SNTS', date_evenement: '2026-11-10' },
      { code: 'ABJC', date_evenement: '2026-11-10' },
    ]);
    expect(r.map((x) => x.code)).toEqual(['SNTS', 'SGBC']);
  });
  it('garde la publication la plus récente quand une valeur en a deux', () => {
    const r = revuesMisesAJour(detenues, [
      { code: 'SNTS', date_evenement: '2026-11-04' },
      { code: 'SNTS', date_evenement: '2026-11-10' },
    ]);
    expect(r).toEqual([{ code: 'SNTS', designation: 'SONATEL', publie_le: '2026-11-10' }]);
  });
  it('aucune publication : liste vide', () => {
    expect(revuesMisesAJour(detenues, [])).toEqual([]);
  });
});
