import { describe, expect, it } from 'vitest';
import {
  calculerActiviteCalendrier,
  construireFiltresCapsules,
  extraireCapsulesLecon,
  extraireCartesRevision,
  extraireMetadonneesCours,
  filtrerCours,
  formatCours,
  formatDuree,
  recommanderPourObjectif,
  type HubCourseEnriched,
} from './capsules';

describe('formatDuree', () => {
  it('formate les durées courtes, heures rondes et heures avec minutes', () => {
    expect(formatDuree(0)).toBe('');
    expect(formatDuree(45)).toBe('45 min');
    expect(formatDuree(60)).toBe('1 h');
    expect(formatDuree(135)).toBe('2 h 15');
    expect(formatDuree(125)).toBe('2 h 05');
  });
});

describe('formatCours', () => {
  it('distingue parcours certifiant et atelier court', () => {
    expect(formatCours('academy-niveau-3-technique')).toBe('parcours');
    expect(formatCours('comprendre-le-per-et-la-valorisation-a-la-brvm')).toBe('atelier');
  });
});

describe('extraireCapsulesLecon', () => {
  it('extrait vidéo, durée, simulateurs, quiz et données BRVM depuis une leçon', () => {
    const caps = extraireCapsulesLecon(
      {
        duree_min: 16,
        quiz: new Array(10).fill({}),
        sections: [
          { simulation: { type: 'frais_ordre' }, simulations: [{ type: 'valeur_future' }] },
          { donnees_reelles: { vue: 'cours', codes: ['SNTS'] } },
        ],
      },
      { hasVideo: true },
    );
    expect(caps.map((c) => c.label)).toEqual([
      'Vidéo',
      'Lecture · 16 min',
      '2 simulateurs',
      'Quiz · 10',
      'Données BRVM',
    ]);
  });

  it('gère le quiz unique historique (qcm) et les leçons sans vidéo', () => {
    const caps = extraireCapsulesLecon({ duree_min: 8, qcm: { question: 'Q' }, sections: [] });
    expect(caps.map((c) => c.label)).toEqual(['Lecture · 8 min', 'Quiz']);
  });
});

describe('extraireMetadonneesCours', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  it('agrège modules, durées, simulateurs, thèmes et capsules prioritaires', () => {
    const meta = extraireMetadonneesCours(
      [
        {
          module: 'Module 1 : Comprendre la Bourse BRVM',
          categorie: 'income',
          duree_min: 16,
          nouveaute: { type: 'mis_a_jour', depuis: '2026-11-24' },
          quiz: new Array(10).fill({}),
          sections: [{ simulation: { type: 'frais_ordre' }, donnees_reelles: { vue: 'cours', codes: ['SNTS'] } }],
        },
        {
          module: 'Module 2 : Passer son premier ordre',
          categorie: 'general',
          duree_min: 10,
          quiz: new Array(5).fill({}),
          sections: [],
        },
      ],
      now,
      { niveau: 'debutant', slug: 'academy-niveau-1-initiation', titre: 'Initiation' },
    );
    expect(meta.modulesCount).toBe(2);
    expect(meta.totalMinutes).toBe(26);
    expect(meta.simulatorsCount).toBe(1);
    expect(meta.quizCount).toBe(15);
    expect(meta.hasRealData).toBe(true);
    expect(meta.themes).toEqual(expect.arrayContaining(['revenus', 'cas_reels']));
    expect(meta.capsules.map((c) => c.label)).toEqual([
      'Récemment mis à jour',
      '1 simulateur',
      'Données réelles BRVM',
    ]);
  });
});

describe('extraireCartesRevision', () => {
  it('extrait formules, pièges, points à retenir et glossaire sans doublons', () => {
    const rev = extraireCartesRevision({
      glossaire: [{ terme: 'SGI', definition: 'Intermédiaire agréé' }],
      lessons: [
        {
          titre: 'Leçon 3',
          sections: [
            {
              type: 'definition',
              titre: 'Formules',
              formules: [{ nom: 'PER', expression: 'Cours ÷ BPA', exemple: '10 000 ÷ 1 000 = 10' }],
            },
            {
              type: 'piege',
              titre: 'Erreurs',
              points: [{ titre: 'Micro-ordre', detail: 'Le minimum de frais pèse lourd.', verifier: 'la grille SGI' }],
            },
            {
              type: 'retenir',
              titre: 'L’essentiel',
              points: [{ titre: 'Diversifier', detail: '20 % max par valeur.' }],
            },
          ],
        },
      ],
    });
    expect(rev.formules).toHaveLength(1);
    expect(rev.pieges).toHaveLength(1);
    expect(rev.flashcards.map((f) => f.categorie)).toEqual(['Formule', 'Piège', 'À retenir', 'Lexique']);
  });
});

describe('filtres, recherche sans accents et recommandations', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const makeCourse = (p: Partial<HubCourseEnriched> & { id: string; slug: string; titre: string }): HubCourseEnriched => ({
    niveau: 'debutant',
    format: 'parcours',
    resume: 'Résumé',
    cover: null,
    lessonsCount: 10,
    modulesCount: 3,
    totalMinutes: 120,
    simulatorsCount: 4,
    quizCount: 50,
    hasRealData: true,
    hasVideo: false,
    categories: ['general'],
    themes: ['cas_reels'],
    badge: null,
    capsules: [],
    moduleTitles: ['Module 1 : Découverte'],
    nextLessonTitle: 'Leçon 1',
    nextLessonCapsules: [],
    progress: { done: 0, total: 10, pct: 0, nextIdx: 0 },
    ...p,
  });

  const sample: HubCourseEnriched[] = [
    makeCourse({
      id: '1',
      slug: 'academy-niveau-1-initiation',
      titre: 'Niveau 1 — Initiation BRVM',
      niveau: 'debutant',
      format: 'parcours',
      themes: ['revenus', 'cas_reels'],
      badge: { type: 'mis_a_jour', libelle: 'Mis à jour' },
      progress: { done: 4, total: 10, pct: 40, nextIdx: 4 },
    }),
    makeCourse({
      id: '2',
      slug: 'academy-niveau-3-technique',
      titre: 'Niveau 3 — Analyse technique',
      niveau: 'avance',
      format: 'parcours',
      themes: ['technique', 'cas_reels'],
      moduleTitles: ['Module 1 : Moyennes mobiles et MACD'],
      progress: { done: 10, total: 10, pct: 100, nextIdx: 9 },
    }),
    makeCourse({
      id: '3',
      slug: 'comprendre-le-per-et-la-valorisation-a-la-brvm',
      titre: 'Comprendre le PER',
      niveau: 'intermediaire',
      format: 'atelier',
      themes: ['fondamental'],
      moduleTitles: ['Atelier : Multiples et PER'],
      simulatorsCount: 0,
      progress: { done: 0, total: 5, pct: 0, nextIdx: 0 },
    }),
  ];

  it('ne construit que les capsules ayant au moins un cours', () => {
    const filtres = construireFiltresCapsules(sample);
    const ids = filtres.map((f) => f.id);
    expect(ids).toContain('tous');
    expect(ids).toContain('debutant');
    expect(ids).toContain('avance');
    expect(ids).toContain('ateliers');
    expect(ids).not.toContain('expert');
  });

  it('filtre par onglet, capsule et requête sans accents', () => {
    expect(filtrerCours(sample, { tab: 'en_cours' }).map((c) => c.slug)).toEqual(['academy-niveau-1-initiation']);
    expect(filtrerCours(sample, { tab: 'termines' }).map((c) => c.slug)).toEqual(['academy-niveau-3-technique']);
    expect(filtrerCours(sample, { tab: 'explorer', query: 'analyse' }).map((c) => c.slug)).toEqual(['academy-niveau-3-technique']);
    expect(filtrerCours(sample, { tab: 'explorer', query: 'decouverte' }).map((c) => c.slug)).toEqual(['academy-niveau-1-initiation']);
    expect(filtrerCours(sample, { tab: 'explorer', filtre: 'ateliers' }).map((c) => c.slug)).toEqual(['comprendre-le-per-et-la-valorisation-a-la-brvm']);
    expect(filtrerCours(sample, { tab: 'explorer', filtre: 'recent' }).map((c) => c.slug)).toEqual(['academy-niveau-1-initiation']);
  });

  it('recommande les cours alignés avec l’objectif', () => {
    expect([...recommanderPourObjectif(sample, 'debuter')]).toEqual(['academy-niveau-1-initiation']);
    expect([...recommanderPourObjectif(sample, 'technique')]).toEqual(['academy-niveau-3-technique']);
    expect([...recommanderPourObjectif(sample, 'certification')]).toHaveLength(2);
  });

  it('calcule le calendrier d’activité mensuel et les compteurs hebdo/quotidien', () => {
    const cal = calculerActiviteCalendrier(
      [
        { completed: true, updated_at: '2026-11-24T10:00:00Z' },
        { completed: true, updated_at: '2026-11-23T18:00:00Z' },
        { completed: true, updated_at: '2026-11-05T09:00:00Z' },
        { completed: false, updated_at: '2026-11-24T11:00:00Z' },
      ],
      now,
    );
    expect(cal.moisLabel).toBe('novembre 2026');
    expect(cal.nbJours).toBe(30);
    expect(cal.jourCourant).toBe(24);
    expect(cal.joursActifs).toEqual([5, 23, 24]);
    expect(cal.leconsAujourdhui).toBe(1);
    expect(cal.leconsSemaine).toBe(2);
  });
});
