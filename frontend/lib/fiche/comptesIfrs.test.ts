import { describe, it, expect } from 'vitest';
import { comptesIfrs, normaliserLigneIfrs, ligneSika, type LigneComptesIfrs } from './comptesIfrs';

// SUCRIVOIRE (SCRC) 2025 — ligne telle qu'en base (PostgREST peut rendre les numeric en texte).
const brute = {
  code: 'SCRC', exercice: 2025,
  chiffre_affaires: '80568589000', resultat_net: '-7953932000', resultat_net_part_groupe: null,
  capitaux_propres: '17243172000', capitaux_propres_part_groupe: null,
  total_actif: '156426278000', dette_financiere: '84873088000',
  source_url: 'https://bfin.brvm.org/x.pdf', source_titre: 'Etats financiers IFRS - Exercice 2025 - SUCRIVOIRE CI',
  verifie_le: '2026-11-08',
  comparaison_sika: {
    source_url: 'https://www.sikafinance.com/marches/societe/SCRC.ci', consulte_le: '2026-11-08',
    referentiel_sika: 'SYSCOHADA', unite_sika: 'millions de FCFA', note: 'n',
    postes: [
      { poste: 'chiffre_affaires', sika: 80569000000, ifrs: 80568589000, ecart: -411000, comparable: true },
      { poste: 'resultat_net', sika: -6132000000, ifrs: -7953932000, ecart: -1821932000, comparable: false },
    ],
  },
};

const syscohada = {
  resultatNet: -6_131_800_226,
  chiffreAffaires: 80_568_589_451,
  capitauxPropres: 13_822_035_189,
  detteFinanciere: 80_127_136_097,
};
const marche = { cours: 1720, titres: 19_600_000, capitalisation: 33_712_000_000 };

describe('normaliserLigneIfrs', () => {
  it('convertit les numeric texte en nombres', () => {
    const l = normaliserLigneIfrs(brute)!;
    expect(l.resultat_net).toBe(-7_953_932_000);
    expect(l.capitaux_propres).toBe(17_243_172_000);
    expect(l.resultat_net_part_groupe).toBeNull();
    expect(l.comparaison_sika?.postes).toHaveLength(2);
  });
  it('rejette une ligne sans source ou sans exercice', () => {
    expect(normaliserLigneIfrs({ ...brute, source_url: null })).toBeNull();
    expect(normaliserLigneIfrs({ ...brute, exercice: null })).toBeNull();
    expect(normaliserLigneIfrs(null)).toBeNull();
  });
  it('comparaison Sika illisible : null, jamais inventée', () => {
    expect(normaliserLigneIfrs({ ...brute, comparaison_sika: 'nimporte' })!.comparaison_sika).toBeNull();
  });
});

describe('comptesIfrs', () => {
  const ligne = normaliserLigneIfrs(brute) as LigneComptesIfrs;

  it('sans ligne IFRS : null', () => {
    expect(comptesIfrs({ ligne: null, exercice: 2025, syscohada, ...marche })).toBeNull();
  });
  it('ligne d’un autre exercice que celui retenu : null (on ne mélange pas deux exercices)', () => {
    expect(comptesIfrs({ ligne, exercice: 2024, syscohada, ...marche })).toBeNull();
    expect(comptesIfrs({ ligne, exercice: null, syscohada, ...marche })).toBeNull();
  });
  it('SCRC 2025 : ratios IFRS calculés par ratiosBilan', () => {
    const c = comptesIfrs({ ligne, exercice: 2025, syscohada, ...marche })!;
    expect(c.ifrs.bpa.valeur).toBe(-405.81);
    expect(c.ifrs.pb).toBeCloseTo(1.955, 3);
    expect(c.ifrs.roe).toBeCloseTo(-0.4613, 4);
    expect(c.ifrs.gearing).toBeCloseTo(4.922, 3);
    expect(c.ifrs.per.motif).toBe('non calculable, perte');
  });
  it('SCRC 2025 : colonne SYSCOHADA sur les mêmes cours et capitalisation', () => {
    const c = comptesIfrs({ ligne, exercice: 2025, syscohada, ...marche })!;
    expect(c.syscohada.bpa.valeur).toBe(-312.85);
    expect(c.syscohada.pb).toBeCloseTo(2.439, 3);
    expect(c.syscohada.roe).toBeCloseTo(-0.4436, 4);
  });
  it('six lignes de comparaison, libellées', () => {
    const c = comptesIfrs({ ligne, exercice: 2025, syscohada, ...marche })!;
    expect(c.lignes.map((l) => l.libelle)).toEqual(['Résultat net', 'Capitaux propres', 'BPA', 'P / valeur comptable', 'ROE', 'Dette / fonds propres']);
    const rn = c.lignes[0]!;
    expect(rn.syscohada).toBe('-6,13 Md FCFA');
    expect(rn.ifrs).toBe('-7,95 Md FCFA');
    const roe = c.lignes[4]!;
    expect(roe.ifrs).toBe('-46,1 %');
    expect(c.surPartDuGroupe).toBe(false);
  });
  it('part du groupe présente : elle sert au BPA et au ROE', () => {
    const l = { ...ligne, resultat_net_part_groupe: -5_000_000_000, capitaux_propres_part_groupe: 10_000_000_000 };
    const c = comptesIfrs({ ligne: l, exercice: 2025, syscohada, ...marche })!;
    expect(c.surPartDuGroupe).toBe(true);
    expect(c.ifrs.roe).toBeCloseTo(-0.5, 6);
  });
  it('donnée manquante : « non disponible », jamais zéro', () => {
    const l = { ...ligne, dette_financiere: null };
    const c = comptesIfrs({ ligne: l, exercice: 2025, syscohada, ...marche })!;
    expect(c.lignes[5]!.ifrs).toBe('non disponible');
  });
});

describe('ligneSika', () => {
  it('CA concordant à l’arrondi, résultat net non comparable', () => {
    const t = ligneSika(normaliserLigneIfrs(brute)!.comparaison_sika)!;
    expect(t).toContain('Sika Finance');
    expect(t).toContain('SYSCOHADA');
    expect(t).toContain("chiffre d'affaires 80,57 Md FCFA, concordant à l'arrondi près");
    expect(t).toContain('résultat net -6,13 Md FCFA, non comparable');
  });
  it('écart réel sur un poste comparable : chiffré', () => {
    const c = { ...normaliserLigneIfrs(brute)!.comparaison_sika!, postes: [{ poste: 'chiffre_affaires', sika: 80_000_000_000, ifrs: 82_000_000_000, ecart: 2_000_000_000, comparable: true }] };
    expect(ligneSika(c)).toContain('écart de 2,00 Md FCFA');
  });
  it('sans comparaison : null', () => {
    expect(ligneSika(null)).toBeNull();
  });
});
