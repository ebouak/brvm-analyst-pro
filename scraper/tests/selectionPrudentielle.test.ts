import { describe, it, expect } from 'vitest';
import { selectionnerExercice, type ObsPrudentielle } from '../src/prudentiel/selection.js';

const D24 = '2024-12-31';
const D25 = '2025-12-31';
let n = 0;
const o = (p: Partial<ObsPrudentielle>): ObsPrudentielle => ({
  id: `o${++n}`, date_arrete: D24, perimetre: 'non_precise', statut: 'publie', valeur: null,
  comparateur: '=', texte_original: null, motif: null, document_url: `doc${n}`, ...p,
});

describe('sélection de la valeur retenue', () => {
  it('une seule valeur exacte → retenue', () => {
    const a = o({ valeur: 19.64, texte_original: '19,64 %' });
    expect(selectionnerExercice([a], D24)).toMatchObject({ etat: 'retenue', valeur: 19.64, classe: 'unique', reserve: null });
  });

  it('compatibles à l’arrondi → la plus précise est retenue (SGBC 2023)', () => {
    const a = o({ valeur: 15.8, texte_original: '15,8 %' });
    const b = o({ valeur: 15.79, texte_original: '15,79 %' });
    expect(selectionnerExercice([a, b], D24)).toMatchObject({ etat: 'retenue', valeur: 15.79, observation: b.id, classe: 'rounding_compatible' });
  });

  it('observations déjà marquées source_conflict → conflit, aucune valeur (BOAS 2024)', () => {
    const a = o({ statut: 'publie_non_exploitable', texte_original: '14,9 %', motif: 'source_conflict' });
    const b = o({ statut: 'publie_non_exploitable', texte_original: '14,4 %', motif: 'source_conflict' });
    expect(selectionnerExercice([a, b], D24)).toEqual({ etat: 'conflit', observations: [a.id, b.id] });
  });

  it('conflit détecté à la sélection même si personne ne l’a marqué', () => {
    const a = o({ valeur: 16.3, texte_original: '16,3 %' });
    const b = o({ valeur: 16, texte_original: '16 %' });
    const c = o({ valeur: 16.19, texte_original: '16,19 %' });
    expect(selectionnerExercice([a, b, c], D24).etat).toBe('conflit');
  });

  it('une borne seule n’est jamais retenue comme valeur exacte (SIBC 2025 : > 14 %)', () => {
    const a = o({ date_arrete: D25, valeur: 14, comparateur: '>', texte_original: 'supérieur à 14 %' });
    expect(selectionnerExercice([a], D25)).toEqual({ etat: 'borne', comparateur: '>', valeur: 14, observation: a.id });
  });

  it('borne respectée par la valeur exacte → la valeur exacte est retenue', () => {
    const a = o({ valeur: 14.39, texte_original: '14,39 %' });
    const b = o({ valeur: 14, comparateur: '>' });
    expect(selectionnerExercice([a, b], D24)).toMatchObject({ etat: 'retenue', valeur: 14.39 });
  });

  it('borne contredite par la valeur exacte → conflit', () => {
    const a = o({ valeur: 13.2, texte_original: '13,2 %' });
    const b = o({ valeur: 14, comparateur: '>' });
    expect(selectionnerExercice([a, b], D24)).toEqual({ etat: 'conflit', observations: [a.id, b.id] });
  });

  it('une estimation n’est pas retenue', () => {
    const a = o({ valeur: 12.6, texte_original: '12,6 %', motif: 'estime' });
    expect(selectionnerExercice([a], D24)).toEqual({ etat: 'non_exploitable', motif: 'estime', observations: [a.id] });
  });

  it('contrôle en cours : valeur retenue, réserve signalée', () => {
    const a = o({ valeur: 14.9, texte_original: '14,9 %', motif: 'controle_en_cours' });
    expect(selectionnerExercice([a], D24)).toMatchObject({ etat: 'retenue', valeur: 14.9, reserve: 'controle_en_cours' });
  });
});

describe('périmètre et exercice', () => {
  it('comptes individuels prioritaires sur le consolidé', () => {
    const conso = o({ perimetre: 'consolide', valeur: 2.2, texte_original: '2,2 %' });
    const indiv = o({ perimetre: 'individuel', valeur: 15.1, texte_original: '15,1 %' });
    expect(selectionnerExercice([conso, indiv], D24)).toMatchObject({ etat: 'retenue', valeur: 15.1, perimetre: 'individuel' });
  });

  it('un conflit en individuel ne se répare pas avec le consolidé', () => {
    const i1 = o({ perimetre: 'individuel', valeur: 16.3, texte_original: '16,3 %' });
    const i2 = o({ perimetre: 'individuel', valeur: 16.19, texte_original: '16,19 %' });
    const c = o({ perimetre: 'consolide', valeur: 15, texte_original: '15 %' });
    expect(selectionnerExercice([i1, i2, c], D24).etat).toBe('conflit');
  });

  it('un exercice ancien ne remplace jamais l’exercice demandé', () => {
    const ancien = o({ date_arrete: D24, valeur: 14.39, texte_original: '14,39 %' });
    expect(selectionnerExercice([ancien], D25)).toEqual({ etat: 'aucune_observation' });
  });

  it('« non trouvé » consigné ≠ rien cherché', () => {
    const a = o({ statut: 'non_trouve' });
    const b = o({ statut: 'non_trouve' });
    expect(selectionnerExercice([a, b], D24)).toEqual({ etat: 'non_trouve', documents: 2 });
    expect(selectionnerExercice([], D24)).toEqual({ etat: 'aucune_observation' });
  });

  it('non applicable', () => {
    expect(selectionnerExercice([o({ statut: 'non_applicable' })], D24)).toEqual({ etat: 'non_applicable' });
  });
});

import { dateArrete } from '../src/prudentiel/runSelection.js';
describe('date d’arrêté d’une période annuelle', () => {
  it('accepte « 2025 » et « 2025-12-31 », refuse le reste', () => {
    expect(dateArrete('2025')).toBe('2025-12-31');
    expect(dateArrete('2025-12-31')).toBe('2025-12-31');
    expect(dateArrete('2024-01-01')).toBeNull();
    expect(dateArrete('2025-S1')).toBeNull();
  });
});
