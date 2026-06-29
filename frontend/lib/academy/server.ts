import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { CourseContent } from './types';

export interface AcademyCourseCard {
  id: string;
  slug: string;
  titre: string;
  niveau: string | null;
  resume: string | null;
  published: boolean;
  created_at: string;
}

const CARD_COLS = 'id, slug, titre, niveau, resume, published, created_at';

/** Cours publiés (catalogue public). */
export async function listPublishedCourses(): Promise<AcademyCourseCard[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('academy_courses')
    .select(CARD_COLS)
    .eq('published', true)
    .order('created_at', { ascending: false });
  return (data ?? []) as AcademyCourseCard[];
}

/** Tous les cours (admin). */
export async function listAllCourses(): Promise<AcademyCourseCard[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('academy_courses')
    .select(CARD_COLS)
    .order('created_at', { ascending: false });
  return (data ?? []) as AcademyCourseCard[];
}

/** HTML rendu d'un cours publié (servi par /api/academy/[slug]). */
export async function getCourseHtml(slug: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from('academy_courses')
    .select('html')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return (data?.html as string | undefined) ?? null;
}

export interface UpsertCourseInput {
  slug: string;
  titre: string;
  niveau: string;
  resume: string | null;
  content: CourseContent;
  html: string;
  createdBy: string | null;
}

/** Crée/écrase un cours (clé naturelle = slug). */
export async function upsertCourse(input: UpsertCourseInput): Promise<{ ok: boolean; message?: string }> {
  const sb = getServiceClient();
  const { error } = await sb.from('academy_courses').upsert(
    {
      slug: input.slug,
      titre: input.titre,
      niveau: input.niveau,
      resume: input.resume,
      content: input.content,
      html: input.html,
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slug' },
  );
  return error ? { ok: false, message: error.message } : { ok: true };
}
