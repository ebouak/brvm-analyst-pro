import test from 'node:test';
import assert from 'node:assert/strict';
import { courseToSlides, splitNumbered } from './slides.ts';

const course = {
  titre: 'Niveau 1 — Initiation',
  niveau: 'debutant',
  intro: 'Un parcours structuré. Deuxième phrase ignorée.',
  lessons: [
    {
      titre: 'Qu’est-ce que la BRVM ?',
      categorie: 'general',
      resume: 'Une infrastructure financière, pas un casino.',
      sections: [
        { type: 'definition', titre: 'Définition', contenu: 'Texte.', stats: [], etapes: [] },
        { type: 'lexique', titre: 'Lexique', contenu: 'Termes.', stats: [], etapes: [] },
        { type: 'retenir', titre: 'À retenir', contenu: '1. Un\n2. Deux', stats: [], etapes: [] },
      ],
      chart: null,
      charts: [
        { type: 'pie', titre: 'Secteurs', labels: ['A', 'B'], valeurs: [1, 2], unite: '%', note: 'n', reel: true },
      ],
      qcm: { question: 'Q ?', options: ['a', 'b'], correct: 1, explication: 'e' },
    },
    {
      titre: 'Les acteurs',
      categorie: 'regulatory',
      resume: 'BRVM, CREPMF, SGI, DC/BR.',
      sections: [{ type: 'definition', titre: 'Rôles', contenu: 'Texte.', stats: [], etapes: [] }],
      chart: null,
      charts: [],
      qcm: null,
    },
  ],
};

test('couverture + sommaire en tête', () => {
  const s = courseToSlides(course);
  assert.equal(s[0].kind, 'cover');
  assert.equal(s[0].sousTitre, 'Un parcours structuré');
  assert.equal(s[1].kind, 'sommaire');
  assert.equal(s[1].items.length, 2);
});

test('leçon 1 : intro + 3 sections + 1 chart + quiz = 6 diapos', () => {
  const s = courseToSlides(course);
  // index 2 = intro leçon 1
  assert.equal(s[2].kind, 'lesson-intro');
  assert.equal(s[2].num, 1);
  const l1 = s.slice(2).filter((x) => 'leconNum' in x && x.leconNum === 1);
  const intro1 = s.filter((x) => x.kind === 'lesson-intro' && x.num === 1);
  assert.equal(intro1.length, 1);
  assert.equal(l1.filter((x) => x.kind === 'section').length, 3);
  assert.equal(l1.filter((x) => x.kind === 'chart').length, 1);
  assert.equal(l1.filter((x) => x.kind === 'quiz').length, 1);
});

test('objectifs = titres des sections de fond (hors lexique/retenir), max 4', () => {
  const s = courseToSlides(course);
  const intro = s.find((x) => x.kind === 'lesson-intro' && x.num === 1);
  assert.deepEqual(intro.objectifs, ['Définition']);
});

test('leçon sans quiz → pas de diapo quiz', () => {
  const s = courseToSlides(course);
  const quizL2 = s.filter((x) => x.kind === 'quiz' && x.leconNum === 2);
  assert.equal(quizL2.length, 0);
});

test('splitNumbered extrait les items numérotés', () => {
  assert.deepEqual(splitNumbered('1. Un\n2. Deux\n3. Trois'), ['Un', 'Deux', 'Trois']);
  assert.deepEqual(splitNumbered('Texte sans numéros'), []);
});
