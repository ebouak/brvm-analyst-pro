import { describe, it, expect } from 'vitest';
import { lienDecision } from './types';

const PDF = 'https://www.brvm.org/sites/default/files/decision_n345_sgi-niger_homologation_des_tarifs.pdf';

describe('lienDecision', () => {
  it('renvoie le PDF officiel d’un barème homologué', () => {
    expect(lienDecision({ confiance: 'homologue_crepmf', sourceUrl: PDF })).toBe(PDF);
  });

  it('ne présente jamais une liste tierce comme la décision officielle', () => {
    expect(lienDecision({ confiance: 'homologue_crepmf', sourceUrl: 'https://www.richbourse.com/common/apprendre/liste-sgi' })).toBeNull();
    expect(lienDecision({ confiance: 'homologue_crepmf', sourceUrl: 'https://exemple.com/decision.pdf' })).toBeNull();
  });

  it('ne lie rien pour un barème agrégé, même vers brvm.org', () => {
    expect(lienDecision({ confiance: 'agrege_public', sourceUrl: PDF })).toBeNull();
  });

  it('ne lie rien sans source', () => {
    expect(lienDecision({ confiance: 'homologue_crepmf', sourceUrl: null })).toBeNull();
    expect(lienDecision(null)).toBeNull();
  });
});
