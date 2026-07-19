import type { CourseContent, Lesson, Section, Chart, Qcm } from './types';

/**
 * Transforme un cours Academy en une suite de diapositives fidèles au support
 * PDF « BRVM Academy » (couverture, sommaire, intro de leçon, sections, cas,
 * pièges, à retenir, graphiques, quiz). Fonction PURE, testée.
 *
 * Une diapo = un écran du mode présentation. Le rendu (couleurs marine/or/vert,
 * cartes, frises) est porté par components/academy/SlideDeck.tsx.
 */

export type Slide =
  | { kind: 'cover'; titre: string; sousTitre: string; stats: { label: string; valeur: string }[] }
  | { kind: 'sommaire'; titre: string; items: { num: number; titre: string; resume: string }[] }
  | { kind: 'lesson-intro'; num: number; sur: string; titre: string; resume: string; objectifs: string[] }
  | { kind: 'section'; leconNum: number; leconTitre: string; section: Section }
  | { kind: 'chart'; leconNum: number; leconTitre: string; chart: Chart }
  | { kind: 'quiz'; leconNum: number; num: number; qcm: Qcm };

/** Première phrase d'un texte — sert d'« objectif » synthétique sur la diapo d'intro. */
function firstSentence(s: string): string {
  const clean = s.replace(/\n/g, ' ').trim();
  const dot = clean.search(/[.!?]/);
  const out = dot > 0 ? clean.slice(0, dot) : clean;
  return out.length > 90 ? `${out.slice(0, 87)}…` : out;
}

function lessonSlides(lesson: Lesson, index: number, total: number): Slide[] {
  const num = index + 1;
  const slides: Slide[] = [];

  // Objectifs = titres des sections « de fond » (hors lexique/à retenir), max 4.
  const objectifs = lesson.sections
    .filter((s) => s.type !== 'lexique' && s.type !== 'retenir')
    .slice(0, 4)
    .map((s) => s.titre);

  slides.push({
    kind: 'lesson-intro',
    num,
    sur: `Leçon ${num} / ${total}`,
    titre: lesson.titre,
    resume: lesson.resume,
    objectifs,
  });

  for (const section of lesson.sections) {
    slides.push({ kind: 'section', leconNum: num, leconTitre: lesson.titre, section });
  }

  const charts: Chart[] = [...(lesson.chart ? [lesson.chart] : []), ...(lesson.charts ?? [])];
  for (const chart of charts) {
    slides.push({ kind: 'chart', leconNum: num, leconTitre: lesson.titre, chart });
  }

  if (lesson.qcm) {
    slides.push({ kind: 'quiz', leconNum: num, num, qcm: lesson.qcm });
  }

  return slides;
}

export function courseToSlides(content: CourseContent): Slide[] {
  const lessons = content.lessons;

  const cover: Slide = {
    kind: 'cover',
    titre: content.titre,
    sousTitre: firstSentence(content.intro),
    stats: [
      { label: 'Capitalisation 2026', valeur: '18 488 Md FCFA' },
      { label: 'Sociétés cotées', valeur: '49' },
      { label: 'Leçons', valeur: String(lessons.length) },
    ],
  };

  const sommaire: Slide = {
    kind: 'sommaire',
    titre: 'Votre parcours',
    items: lessons.map((l, i) => ({ num: i + 1, titre: l.titre, resume: firstSentence(l.resume) })),
  };

  return [cover, sommaire, ...lessons.flatMap((l, i) => lessonSlides(l, i, lessons.length))];
}

/** Découpe un contenu « 1. … 2. … » en items numérotés (cartes « à retenir »). */
export function splitNumbered(contenu: string): string[] {
  const items = contenu
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, ''));
  return items;
}
