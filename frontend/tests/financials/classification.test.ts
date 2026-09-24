import { describe, it, expect } from 'vitest';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';

// Ces deux tests sont un CLIQUET : ils échouent dès qu'une valeur est ajoutée
// sans que sa famille comptable ait été décidée. Ils ont fonctionné le
// 24/09/2026 en attrapant BBGC. Les mettre à jour = confirmer le classement,
// jamais simplement rétablir le vert.
describe('FAMILLE_PAR_CODE', () => {
  it('couvre exactement 49 codes', () => {
    expect(Object.keys(FAMILLE_PAR_CODE)).toHaveLength(49);
  });

  it('contient 16 banques et 33 général, 0 assurance', () => {
    const vals = Object.values(FAMILLE_PAR_CODE);
    // 16e banque : BBGC (Bridge Bank Group CI), cotée le 24/09/2026.
    expect(vals.filter((v) => v === 'banque')).toHaveLength(16);
    expect(vals.filter((v) => v === 'general')).toHaveLength(33);
    expect(vals.filter((v) => v === 'assurance')).toHaveLength(0);
  });

  it('toutes les valeurs sont des familles valides', () => {
    for (const v of Object.values(FAMILLE_PAR_CODE)) {
      expect(['banque', 'assurance', 'general']).toContain(v);
    }
  });
});
