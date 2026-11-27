import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Lecon7RisquesExperience from '@/components/academy/lecon/risques/Lecon7RisquesExperience';
import { lessonSchema } from './types';
import l7Brut from './contenus/lecon7-risques.json';
import type { DonneesSection } from './donneesServer';

const DONNEES_HISTORIQUES_MOCK: Record<number, DonneesSection | null> = {
  1: {
    vue: 'historique',
    exercices: [2020, 2021, 2022, 2023, 2024],
    manquants: [],
    lignes: [
      {
        code: 'SNTS',
        nom: 'SONATEL SENEGAL',
        versements: 5,
        baisses: 0,
        montants: [
          { exercice: 2020, montant: 1225, baseNette: true, base: 'net' },
          { exercice: 2021, montant: 1400, baseNette: true, base: 'net' },
          { exercice: 2022, montant: 1500, baseNette: true, base: 'net' },
          { exercice: 2023, montant: 1575, baseNette: true, base: 'net' },
          { exercice: 2024, montant: 1655, baseNette: true, base: 'net' },
        ],
      },
      {
        code: 'PALC',
        nom: 'PALMCI',
        versements: 5,
        baisses: 2,
        montants: [
          { exercice: 2020, montant: 102, baseNette: false, base: null },
          { exercice: 2021, montant: 1236, baseNette: true, base: 'net' },
          { exercice: 2022, montant: 1213, baseNette: true, base: 'net' },
          { exercice: 2023, montant: 563, baseNette: true, base: 'net' },
          { exercice: 2024, montant: 750, baseNette: true, base: 'net' },
        ],
      },
      {
        code: 'NTLC',
        nom: 'NESTLE COTE D’IVOIRE',
        versements: 5,
        baisses: 1,
        montants: [
          { exercice: 2020, montant: 364, baseNette: true, base: 'net' },
          { exercice: 2021, montant: 856, baseNette: true, base: 'net' },
          { exercice: 2022, montant: 728, baseNette: true, base: 'net' },
          { exercice: 2023, montant: 675, baseNette: true, base: 'net' },
          { exercice: 2024, montant: 720, baseNette: true, base: 'net' },
        ],
      },
      {
        code: 'SPHC',
        nom: 'SAPH COTE D’IVOIRE',
        versements: 5,
        baisses: 2,
        montants: [
          { exercice: 2020, montant: 130, baseNette: true, base: 'net' },
          { exercice: 2021, montant: 365, baseNette: true, base: 'net' },
          { exercice: 2022, montant: 295, baseNette: true, base: 'net' },
          { exercice: 2023, montant: 64, baseNette: true, base: 'net' },
          { exercice: 2024, montant: 110, baseNette: true, base: 'net' },
        ],
      },
    ],
  },
};

describe('leçon 7 — reconception premium (rendu complet)', () => {
  const lesson = lessonSchema.parse(l7Brut);

  it('conserve les 8 étapes et les 11 questions du quiz', () => {
    expect(lesson.experience).toBe('risques');
    expect(lesson.sections).toHaveLength(8);
    expect(lesson.quiz).toHaveLength(11);
  });

  it('rend l’introduction éditoriale, les 8 étapes, les simulateurs et le quiz sans NaN ni réponse dévoilée', () => {
    const html = renderToStaticMarkup(
      createElement(Lecon7RisquesExperience, {
        lesson,
        quizPassed: false,
        onQuizAnswer: () => {},
        donnees: DONNEES_HISTORIQUES_MOCK,
      }),
    );

    // Introduction & progression 8 étapes
    expect(html).toContain('En Bourse, protéger son capital est aussi important que le faire fructifier.');
    expect(html).toContain('08');
    expect(html).toContain('Check-list et quiz');

    // Cartographie des risques & données réelles de liquidité BRVM
    expect(html).toContain('Le risque de marché');
    expect(html).toContain('Le risque propre à une entreprise');
    expect(html).toContain('Le risque de liquidité');
    expect(html).toContain('SONATEL SENEGAL');

    // Dividendes réels & commentaire automatique
    expect(html).toContain('PALMCI');
    expect(html).toContain('Lecture pédagogique automatique');

    // Simulateur de diversification & avertissement corrélations / marché
    expect(html).toContain('Construire et éprouver un portefeuille');
    expect(html).toContain('elle ne supprime pas le risque de marché');
    expect(html).toContain('corrélations entre titres');

    // Simulateur d'ordres BRVM 3 colonnes (A, B, C) & résultat 5 000 actions = 3 283 FCFA
    expect(html).toContain('Carnet d’ordres');
    expect(html).toContain('Formulaire d’ordre');
    expect(html).toContain('Résultat simulé');
    expect(html.replace(/\s/g, ' ')).toContain('3 283 FCFA');

    // Parcours baisse de 20 % & calculateur d'épargne de précaution
    expect(html).toContain('Votre action perd 20 %. Quelle est votre réaction ?');
    expect(html).toContain('Quelle hausse faut-il pour effacer une baisse ?');
    expect(html).toContain('Calculer votre épargne de précaution');
    expect(html.replace(/\s/g, ' ')).toContain('1 500 000 FCFA');

    // Quiz : Question 1 sur 11, aucune bonne réponse affichée avant validation
    expect(html).toContain('Question 1 sur 11');
    expect(html).toContain('Valider ma réponse');
    expect(html).not.toContain('Bonne réponse');
    expect(html).not.toContain('is-correct');

    // Mention réglementaire
    expect(html).toContain('Ceci n’est pas un conseil en investissement.');
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
