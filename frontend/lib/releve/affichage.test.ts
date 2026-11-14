import { describe, it, expect } from 'vitest';
import {
  LIGNES_PAR_FEUILLE, decouper, fcfa, libelleMois, lireReleve, nombreDeFeuilles, pointsSignes, pourcent, pourcentSigne, tonVariation,
} from './affichage';
import type { ReleveJson } from './types';

const releve = (o: Partial<ReleveJson> = {}): ReleveJson => ({
  version: 2, type: 'reel', titre: 'Relevé du portefeuille', mois: '2026-10', genere_le: '2026-11-02T08:00:00Z',
  debut: '2026-10-01', fin: '2026-10-31', derniere_seance: '2026-10-30',
  resume: { valeur_depart: 100, valeur_fin: 110, variation: 10, variation_pct: 10, nb_lignes: 1, nb_exclues: 0 },
  lignes: [], exclues: [],
  dividendes: { detaches: [], encaisses: [], total_detaches: { montant: null, base: null, nb: 0 }, total_encaisses: { montant: null, base: null, nb: 0 } },
  publications: { liste: [], non_listees: 0 },
  concentration: { premiere_ligne: null, premier_secteur: null, sans_secteur_pct: null },
  rendez_vous: [],
  ...o,
});

describe('lireReleve', () => {
  it('reconnaît la version 2', () => {
    expect(lireReleve(releve())).not.toBeNull();
  });
  it('refuse l’ancien format, une version future, du vide et du JSON tronqué', () => {
    expect(lireReleve({ month: '2026-06', kpis: { pnlTotal: 1 }, recommendations: 'x' })).toBeNull();
    expect(lireReleve({ ...releve(), version: 3 })).toBeNull();
    expect(lireReleve(null)).toBeNull();
    expect(lireReleve('texte')).toBeNull();
    expect(lireReleve({ version: 2, type: 'reel', mois: '2026-10' })).toBeNull();
    expect(lireReleve({ ...releve(), type: 'autre' })).toBeNull();
  });
});

describe('découpage en feuilles', () => {
  it('une tranche vide est conservée : la feuille garde son message d’état vide', () => {
    expect(decouper([], 5)).toEqual([[]]);
  });
  it('aucune ligne n’est perdue ni dupliquée', () => {
    const l = Array.from({ length: 31 }, (_, i) => i);
    const t = decouper(l, LIGNES_PAR_FEUILLE.positions);
    expect(t.flat()).toEqual(l);
    expect(t.every((x) => x.length <= LIGNES_PAR_FEUILLE.positions)).toBe(true);
  });
  it('nombre de feuilles : synthèse + lignes + dividendes + publications + rendez-vous', () => {
    expect(nombreDeFeuilles(releve())).toBe(5);
  });
  it('un relevé simulé n’a pas de feuille de dividendes', () => {
    expect(nombreDeFeuilles(releve({ type: 'simule', dividendes: null }))).toBe(4);
  });
  it('les lignes exclues comptent dans le tableau des lignes', () => {
    const exclues = Array.from({ length: LIGNES_PAR_FEUILLE.positions }, (_, i) => ({ code: `X${i}`, designation: 'x', motif: 'cours indisponible' }));
    expect(nombreDeFeuilles(releve({ exclues }))).toBe(5);
    expect(nombreDeFeuilles(releve({ exclues: [...exclues, { code: 'Y', designation: 'y', motif: 'm' }] }))).toBe(6);
  });
});

describe('formats', () => {
  it('mois en français', () => {
    expect(libelleMois('2026-10')).toBe('octobre 2026');
    expect(libelleMois('2026-12')).toBe('décembre 2026');
  });
  it('FCFA entier groupé, nul si absent', () => {
    expect(fcfa(1234567.4)?.replace(/\s/g, ' ')).toBe('1 234 567');
    expect(fcfa(null)).toBeNull();
    expect(fcfa(Number.NaN)).toBeNull();
  });
  it('pourcentage signé : jamais de « +0,00 % » ni de signe sur un zéro arrondi', () => {
    expect(pourcentSigne(4.123)?.replace(/\s/g, ' ')).toBe('+4,12 %');
    expect(pourcentSigne(-0.5)?.replace(/\s/g, ' ')).toBe('−0,50 %');
    expect(pourcentSigne(0.001)?.replace(/\s/g, ' ')).toBe('0,00 %');
    expect(pourcentSigne(null)).toBeNull();
    expect(pourcent(62.4)?.replace(/\s/g, ' ')).toBe('62,4 %');
    expect(pointsSignes(1.234)?.replace(/\s/g, ' ')).toBe('+1,23 pt');
    expect(pointsSignes(undefined)).toBeNull();
  });
  it('ton d’une variation : aucun sur zéro ou donnée absente', () => {
    expect(tonVariation(2)).toBe('hausse');
    expect(tonVariation(-2)).toBe('baisse');
    expect(tonVariation(0)).toBeNull();
    expect(tonVariation(0.001)).toBeNull();
    expect(tonVariation(null)).toBeNull();
  });
});
