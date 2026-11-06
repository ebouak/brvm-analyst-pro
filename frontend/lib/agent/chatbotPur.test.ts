import { describe, it, expect } from 'vitest';
import { chiffresParAction, classerNotions, lireListeValeurs, sansSignal, type LeconIndex } from './chatbotPur';

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

describe('chiffresParAction', () => {
  const snts = { exercice: '2025', resultatNet: 413_588_000_000, bpa: 413.6, dpa: 174, titres: 1_000_000_000, cours: 4000, anneeSeance: 2026 };

  it('SNTS après fractionnement : BPA gardé, PER identique au calcul de la fiche société', () => {
    expect(chiffresParAction(snts)).toEqual({
      exercice: '2025',
      bpa_fcfa: 413.6,
      dividende_par_action_fcfa: 174,
      per: 9.7,
      base_per: 'résultat net consolidé, intérêts minoritaires inclus',
    });
  });

  it('écarte un BPA qui ne colle pas au résultat ÷ titres (BOAC, valeurs réelles)', () => {
    expect(chiffresParAction({ ...snts, resultatNet: 35_540_000_000, bpa: 888.5, dpa: 594.5, titres: 60_000_000, cours: 11995 })).toBeNull();
  });

  it('écarte des comptes trop anciens (STAC, exercice 2021)', () => {
    expect(chiffresParAction({ ...snts, exercice: '2021', anneeSeance: 2026 })).toBeNull();
  });

  it('écarte toute donnée manquante, sans la deviner', () => {
    expect(chiffresParAction({ ...snts, titres: null })).toBeNull();
    expect(chiffresParAction({ ...snts, bpa: null })).toBeNull();
    expect(chiffresParAction({ ...snts, exercice: null })).toBeNull();
  });

  it('un dividende nul vaut inconnu, pas zéro', () => {
    expect(chiffresParAction({ ...snts, dpa: 0 })?.dividende_par_action_fcfa).toBeNull();
  });

  it('en cas de perte : BPA gardé, pas de PER (SCRC, valeurs réelles)', () => {
    const r = chiffresParAction({ ...snts, resultatNet: -6_130_000_000, bpa: -313, dpa: 0, titres: 19_600_000, cours: 1720 });
    expect(r?.bpa_fcfa).toBe(-313);
    expect(r?.per).toBeNull();
  });
});
