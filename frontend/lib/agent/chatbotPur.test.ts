import { describe, it, expect } from 'vitest';
import { classerNotions, lireListeValeurs, sansSignal, type LeconIndex } from './chatbotPur';

const LECONS: LeconIndex[] = [
  { cours: 'Niveau 2', slug: 'academy-niveau-2-fondamental', titre: 'Leçon 2 — Le PER : évaluer la cherté d’une action' },
  { cours: 'Niveau 1', slug: 'academy-niveau-1-initiation', titre: 'Leçon 5 — Les dividendes : construire un revenu passif' },
  { cours: 'Niveau 1', slug: 'academy-niveau-1-initiation', titre: 'Leçon 9 — Ouvrir un compte et passer son premier ordre' },
];

describe('notions', () => {
  it('trouve la leçon par les termes du sujet, accents, casse et pluriel ignorés', () => {
    expect(classerNotions('c’est quoi le PER ?', LECONS).map((l) => l.titre)).toEqual([LECONS[0]!.titre]);
    expect(classerNotions('dividende', LECONS)[0]!.titre).toBe(LECONS[1]!.titre);
    expect(classerNotions('comment ouvrir un compte', LECONS)[0]!.titre).toBe(LECONS[2]!.titre);
  });
  it('rien de pertinent : liste vide', () => {
    expect(classerNotions('la météo', LECONS)).toEqual([]);
    expect(classerNotions('', LECONS)).toEqual([]);
  });
});

describe('outils', () => {
  it('retire signal et confiance, garde le reste', () => {
    expect(sansSignal({ code: 'SNTS', cours: 1, signal: 'BUY', confiance: 0.7 })).toEqual({ code: 'SNTS', cours: 1 });
    expect(sansSignal(null)).toBeNull();
  });
  it('liste de valeurs à comparer', () => {
    expect(lireListeValeurs('SNTS, ORAC')).toEqual(['SNTS', 'ORAC']);
    expect(lireListeValeurs('Sonatel et Orange CI')).toEqual(['Sonatel', 'Orange CI']);
    expect(lireListeValeurs('SNTS')).toBeNull();
  });
});
