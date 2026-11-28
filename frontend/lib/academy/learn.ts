import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { courseContentSchema, type CourseContent } from './types';
import { loadExercise } from './exercisesServer';
import type { PublicExercise } from './exercises';
import { chargerDonneesReelles, type DonneesLecons } from './donneesServer';

/**
 * Données du shell d'apprentissage : contenu du cours (service client, publié
 * uniquement) + progression et notes de l'utilisateur (client SSR → RLS owner).
 */

export interface LessonState {
  completed: boolean;
  quizPassed: boolean | null;
  exercicePassed: boolean | null;
  updatedAt?: string | null;
}

export interface LearnData {
  courseId: string;
  slug: string;
  content: CourseContent;
  /** Par index de leçon. Absent = jamais ouverte. */
  progress: Record<number, LessonState>;
  /** Notes personnelles par index de leçon. */
  notes: Record<number, string>;
  /** Exercices live chargés (leçons ayant un exercice_id, données du jour). */
  exercises: Record<number, PublicExercise>;
  /** Exemples réels des sections `donnees_reelles` (lecture de la base au chargement). */
  donnees: DonneesLecons;
}

/**
 * DÉVELOPPEMENT SEULEMENT — voir une leçon réécrite AVANT de l'écrire en base.
 * `ACADEMY_LECON_LOCALE=<slug>:<index>:<chemin du JSON>` remplace, champ par
 * champ, la leçon `<index>` (0 = leçon 1) du cours `<slug>` ; le reste du cours
 * vient de la base. Inerte hors `next dev` : la garde NODE_ENV ne laisse rien
 * passer en production, et la variable n'existe pas sur Vercel.
 */
async function avecLeconLocale(slug: string, content: unknown): Promise<unknown> {
  const spec = process.env.ACADEMY_LECON_LOCALE;
  if (process.env.NODE_ENV !== 'development' || !spec) return content;
  const [cible, index, ...chemin] = spec.split(':');
  const i = Number(index);
  if (cible !== slug || !Number.isInteger(i) || !content || typeof content !== 'object') return content;
  const { readFile } = await import('node:fs/promises');
  const locale = JSON.parse(await readFile(chemin.join(':'), 'utf8')) as Record<string, unknown>;
  const c = content as { lessons?: Record<string, unknown>[] };
  if (!c.lessons?.[i]) return content;
  const lessons = [...c.lessons];
  lessons[i] = { ...lessons[i], ...locale };
  return { ...c, lessons };
}

export async function loadCourseForLearning(slug: string): Promise<LearnData | null> {
  const svc = getServiceClient();
  const { data: course } = await svc
    .from('academy_courses')
    .select('id, slug, content')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!course) return null;

  const parsed = courseContentSchema.safeParse(await avecLeconLocale(slug, course.content));
  if (!parsed.success) {
    // Contenu corrompu → 404 plutôt qu'un crash, mais JAMAIS en silence : le
    // 2026-11-25, un champ `coverUrl` rejeté a fermé les Niveaux 2 à 4 à leurs
    // acheteurs pendant des jours sans laisser aucune trace.
    const champs = parsed.error.issues.slice(0, 5).map((i) => i.path.join('.') || '(racine)');
    console.error(`[academy] contenu invalide pour ${slug} : ${champs.join(', ')}`);
    Sentry.captureMessage(`Academy : contenu de cours invalide (${slug})`, {
      level: 'error',
      fingerprint: ['academy-contenu-invalide', slug],
      extra: { slug, champs },
    });
    return null;
  }

  // Lignes utilisateur via la session (RLS owner) — vide si non connecté.
  const db = createClient();
  const [{ data: prog }, { data: notes }] = await Promise.all([
    db.from('academy_progress')
      .select('lesson_idx, completed, quiz_passed, exercice_passed, updated_at')
      .eq('course_id', course.id),
    db.from('academy_notes')
      .select('lesson_idx, note')
      .eq('course_id', course.id),
  ]);

  const progress: Record<number, LessonState> = {};
  for (const r of (prog ?? []) as {
    lesson_idx: number; completed: boolean; quiz_passed: boolean | null; exercice_passed: boolean | null; updated_at?: string | null;
  }[]) {
    progress[r.lesson_idx] = {
      completed: r.completed,
      quizPassed: r.quiz_passed,
      exercicePassed: r.exercice_passed ?? null,
      updatedAt: r.updated_at ?? null,
    };
  }
  const notesMap: Record<number, string> = {};
  for (const r of (notes ?? []) as { lesson_idx: number; note: string }[]) {
    notesMap[r.lesson_idx] = r.note;
  }

  // Exercices live des leçons qui en déclarent un (données du jour, tolérant
  // aux pannes : un loader qui échoue = pas d'exercice affiché, jamais de crash).
  const exercises: Record<number, PublicExercise> = {};
  await Promise.all(
    parsed.data.lessons.map(async (l, i) => {
      if (!l.exercice_id) return;
      const built = await loadExercise(l.exercice_id).catch(() => null);
      if (built) exercises[i] = built.pub;
    }),
  );

  const donnees = await chargerDonneesReelles(parsed.data.lessons);

  return { courseId: course.id, slug: course.slug, content: parsed.data, progress, notes: notesMap, exercises, donnees };
}

/**
 * Essai gratuit : ne garde le contenu que de la leçon `ouverte`. Les autres
 * deviennent des coquilles (titre, résumé, module, durée : ce que montre le
 * sommaire verrouillé), sans sections, quiz, graphiques ni exercice.
 */
export function restreindreAEssai(data: LearnData, ouverte: number): LearnData {
  const lessons = data.content.lessons.map((l, i) =>
    i === ouverte
      ? l
      : {
          titre: l.titre,
          categorie: l.categorie,
          sous_titre: l.sous_titre ?? null,
          resume: l.resume,
          module: l.module ?? null,
          duree_min: l.duree_min ?? null,
          nouveaute: l.nouveaute ?? null,
          sections: [],
          charts: [],
          liens: [],
        },
  ) as LearnData['content']['lessons'];
  const exercises: LearnData['exercises'] = {};
  if (data.exercises[ouverte]) exercises[ouverte] = data.exercises[ouverte];
  const donnees: LearnData['donnees'] = {};
  if (data.donnees[ouverte]) donnees[ouverte] = data.donnees[ouverte];
  return { ...data, content: { ...data.content, lessons }, exercises, donnees };
}
