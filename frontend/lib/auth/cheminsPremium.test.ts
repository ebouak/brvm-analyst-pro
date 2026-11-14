import { describe, it, expect } from 'vitest';
import { estCheminPremium } from './cheminsPremium';

describe('estCheminPremium', () => {
  it('les pages /premium/* sont réservées', () => {
    expect(estCheminPremium('/premium/diagnostic')).toBe(true);
    expect(estCheminPremium('/premium')).toBe(true);
  });
  it('exemptions : offre et portefeuille virtuel', () => {
    expect(estCheminPremium('/premium/upgrade')).toBe(false);
    expect(estCheminPremium('/premium/paper-trading')).toBe(false);
    expect(estCheminPremium('/premium/paper-trading/historique')).toBe(false);
  });
  it('un préfixe voisin n’est pas une page premium', () => {
    expect(estCheminPremium('/premiumx')).toBe(false);
    expect(estCheminPremium('/pricing')).toBe(false);
  });
});
