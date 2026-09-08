import { describe, it, expect } from 'vitest';
import { buildMatcher } from '../src/dividends/sikafinance.js';

/**
 * Régression du 2026-09-08.
 *
 * Sikafinance TRONQUE ses libellés à 20 caractères. Les alias curés attendaient
 * des noms complets (« bank of africa senegal »), ne matchaient donc pas
 * « BANK OF AFRICA SENEG », et le repli flou attribuait ces dividendes à une
 * société VOISINE sans rien signaler : 4 années sur 4 de BOA Sénégal stockées
 * sous BOA Burkina, 4 années de Total Sénégal sous Total CI.
 *
 * C'est le pire défaut possible sur ce jeu de données parce qu'il est
 * invisible — les montants restent parfaitement plausibles.
 */

// Référentiel réduit aux cas qui se ressemblent : c'est là que le repli flou
// se trompait.
const REFERENTIEL = [
  { code: 'BOAS', designation: 'BANK OF AFRICA SENEGAL' },
  { code: 'BOABF', designation: 'Bank Of Africa Burkina Faso' },
  { code: 'BOAB', designation: 'BANK OF AFRICA BENIN' },
  { code: 'BOAM', designation: 'BANK OF AFRICA MALI' },
  { code: 'BOAN', designation: 'BANK OF AFRICA NIGER' },
  { code: 'BOAC', designation: 'BANK OF AFRICA CI' },
  { code: 'TTLC', designation: 'TOTAL CI' },
  { code: 'TTLS', designation: 'TOTAL SENEGAL' },
  { code: 'SNTS', designation: 'SONATEL' },
  { code: 'NTLC', designation: 'NESTLE CI' },
];

describe('buildMatcher — libellés tronqués de sikafinance', () => {
  const match = buildMatcher(REFERENTIEL);

  it('rattache les libellés TRONQUÉS à la bonne société', () => {
    // Exactement les chaînes servies par sikafinance (20 caractères max).
    expect(match('BANK OF AFRICA SENEG')).toBe('BOAS');
    expect(match('BANK OF AFRICA BURKI')).toBe('BOABF');
    expect(match('BANK OF AFRICA BENIN')).toBe('BOAB');
    expect(match('BANK OF AFRICA MALI')).toBe('BOAM');
    expect(match('BANK OF AFRICA NIGER')).toBe('BOAN');
    expect(match('BANK OF AFRICA CI')).toBe('BOAC');
  });

  it('ne confond plus Total Sénégal avec Total CI', () => {
    expect(match('TOTAL SENEGAL')).toBe('TTLS');
    expect(match('TOTAL CI')).toBe('TTLC');
  });

  it('rattache encore les noms complets', () => {
    expect(match('SONATEL')).toBe('SNTS');
    expect(match('NESTLE CI')).toBe('NTLC');
  });

  it('RENONCE plutôt que de trancher une ressemblance ambiguë', () => {
    // Une société inconnue ne doit jamais être rattachée « au plus proche » :
    // c'est ce comportement qui a fabriqué les fausses attributions.
    expect(match('SOCIETE TOTALEMENT INCONNUE SA')).toBeNull();
    expect(match('BANQUE X')).toBeNull();
  });

  it('ne rattache pas un code absent du référentiel', () => {
    // Alias curé présent, mais l'instrument n'existe pas : on renonce.
    const restreint = buildMatcher([{ code: 'SNTS', designation: 'SONATEL' }]);
    expect(restreint('TOTAL SENEGAL')).toBeNull();
  });
});
