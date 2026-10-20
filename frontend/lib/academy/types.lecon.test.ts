import { describe, it, expect } from 'vitest';
import { lessonSchema, libelleSection, sectionSchema } from './types';

const ancienne = {
  titre: 'Leçon 1 — Qu’est-ce que la BRVM ?',
  resume: 'Une bourse commune à huit pays.',
  sections: [{ type: 'definition', titre: 'La BRVM', contenu: 'Bourse régionale.' }],
};

const enrichie = {
  ...ancienne,
  sous_titre: 'Comprendre le mécanisme, calculer son rendement, mesurer l’effet du réinvestissement.',
  avertissement: 'Ceci n’est pas un conseil en investissement.',
  sections: [
    {
      type: 'definition',
      titre: 'Comprendre le dividende',
      contenu: 'Une part du bénéfice versée aux actionnaires.',
      formules: [{ nom: 'Revenu brut', expression: 'Nombre d’actions × Dividende par action', exemple: '300 × 1 000 = 300 000 FCFA' }],
      flux: [
        { titre: 'Entreprise', detail: 'Réalise un bénéfice', icone: 'entreprise' },
        { titre: 'Actionnaires', detail: 'Reçoivent le dividende', icone: 'actionnaires' },
      ],
    },
    {
      type: 'cas',
      titre: 'Réinvestir',
      contenu: 'Simulation.',
      simulation: { type: 'reinvestissement', actions: 300, dpa: 1000, cours: 10000, croissance_pct: 5, annees: 5 },
    },
    {
      type: 'cas',
      titre: 'Objectif',
      contenu: 'Capital nécessaire.',
      simulation: { type: 'objectif', revenu_cible: 600000, rendements_pct: [6, 8] },
    },
    {
      type: 'importance',
      titre: 'Les dates',
      contenu: 'Trois dates.',
      etapes: [{ titre: 'Décision' }, { titre: 'Détachement', cle: true }, { titre: 'Paiement' }],
      etapes_style: 'frise',
    },
    {
      type: 'piege',
      titre: 'Erreurs',
      contenu: 'À éviter.',
      points: [{ titre: 'Le seul rendement', detail: 'Un rendement élevé peut signaler un risque.', verifier: 'La régularité sur 5 ans.' }],
    },
  ],
};

describe('schéma de leçon — blocs éditoriaux optionnels', () => {
  it('une leçon existante, sans aucun nouveau bloc, reste valide', () => {
    const r = lessonSchema.safeParse(ancienne);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sections[0]!.etapes_style).toBe('liste');
  });

  it('une leçon enrichie (formules, flux, simulations, frise, points) est valide', () => {
    const r = lessonSchema.safeParse(enrichie);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it('un flux d’une seule étape ou un pictogramme inconnu sont refusés', () => {
    const base = { type: 'definition', titre: 't', contenu: 'c' };
    expect(sectionSchema.safeParse({ ...base, flux: [{ titre: 'Seul', icone: 'entreprise' }] }).success).toBe(false);
    expect(
      sectionSchema.safeParse({ ...base, flux: [{ titre: 'A', icone: 'fusee' }, { titre: 'B', icone: 'piece' }] }).success,
    ).toBe(false);
  });

  it('une simulation incohérente est refusée', () => {
    const base = { type: 'cas', titre: 't', contenu: 'c' };
    expect(sectionSchema.safeParse({ ...base, simulation: { type: 'objectif', revenu_cible: 600000, rendements_pct: [0] } }).success).toBe(false);
    expect(
      sectionSchema.safeParse({ ...base, simulation: { type: 'reinvestissement', actions: 300, dpa: 1000, cours: 10000, croissance_pct: 5, annees: 40 } }).success,
    ).toBe(false);
  });

  it('« Cas réel BRVM » seulement quand le cas est réel ; sinon « Exemple »', () => {
    const cas = sectionSchema.parse({ type: 'cas', titre: 't', contenu: 'c' });
    expect(libelleSection(cas)).toBe('Exemple');
    expect(libelleSection({ ...cas, reel: true })).toBe('Cas réel BRVM');
  });
});
