import { describe, it, expect } from 'vitest';
import { AVERTISSEMENT_ANALYSE, libelleProvenance, texteACopier } from './affichage';

describe('affichage', () => {
  it('provenance', () => {
    expect(libelleProvenance('jev')).toBe('Réponse Jev · type-safe · données WESTBOURSE, sans rédaction par IA');
    expect(libelleProvenance('ia')).toBe('Réponse rédigée par IA à partir des données WESTBOURSE');
  });
  it('avertissement fixe', () => {
    expect(AVERTISSEMENT_ANALYSE).toMatch(/pas un conseil en investissement/);
    expect(AVERTISSEMENT_ANALYSE).toMatch(/vérifiées par un humain/);
  });
  it('copie avec provenance, sources et avertissement', () => {
    const t = texteACopier(' Réponse. ', 'ia', ['Cotations · données au 6 nov. 2026']);
    expect(t.startsWith('Réponse.')).toBe(true);
    expect(t).toContain('rédigée par IA');
    expect(t).toContain('Sources : Cotations');
    expect(t).toContain(AVERTISSEMENT_ANALYSE);
  });
});
