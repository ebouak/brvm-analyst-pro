'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { parseVideoUrl } from '@/lib/video/parseUrl';

type Result = { ok: boolean; error?: string };

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/** Crée un cours (brouillon). */
export async function createCourse(formData: FormData): Promise<Result> {
  const ctx = await requirePermission('content.write');
  const titre = String(formData.get('titre') ?? '').trim();
  if (!titre) return { ok: false, error: 'Titre requis' };
  const niveau = String(formData.get('niveau') ?? 'debutant');
  const resume = String(formData.get('resume') ?? '').trim() || null;
  const slug = slugify(titre) || `cours-${Date.now()}`;

  const sb = getServiceClient();
  const { data, error } = await sb.from('video_courses')
    .insert({ slug, titre, resume, niveau, published: false })
    .select('id').single();
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, { action: 'module.course.create', resourceType: 'video_course', resourceId: data.id, severity: 'info' });
  revalidatePath('/admin/formations/modules');
  return { ok: true };
}

/** Publie / dépublie un cours. */
export async function setCoursePublished(courseId: string, published: boolean): Promise<Result> {
  const ctx = await requirePermission('content.write');
  const sb = getServiceClient();
  const { error } = await sb.from('video_courses')
    .update({ published, updated_at: new Date().toISOString() }).eq('id', courseId);
  if (error) return { ok: false, error: error.message };
  await recordAudit(ctx, { action: published ? 'module.course.publish' : 'module.course.unpublish', resourceType: 'video_course', resourceId: courseId, severity: 'info' });
  revalidatePath('/admin/formations/modules');
  revalidatePath('/formations/modules');
  return { ok: true };
}

/** Ajoute une leçon (à la fin) — le lien vidéo est analysé automatiquement. */
export async function addLesson(courseId: string, formData: FormData): Promise<Result> {
  const ctx = await requirePermission('content.write');
  const titre = String(formData.get('titre') ?? '').trim();
  const lien = String(formData.get('lien') ?? '').trim();
  if (!titre) return { ok: false, error: 'Titre requis' };
  const parsed = parseVideoUrl(lien);
  if (!parsed) return { ok: false, error: 'Lien vidéo non reconnu (YouTube, Vimeo ou URL .mp4)' };

  const sb = getServiceClient();
  const { data: last } = await sb.from('video_lessons')
    .select('ordre').eq('course_id', courseId).order('ordre', { ascending: false }).limit(1).maybeSingle();
  const ordre = (last?.ordre ?? 0) + 1;

  const { data, error } = await sb.from('video_lessons')
    .insert({ course_id: courseId, titre, provider: parsed.provider, video_url: parsed.video_url, ordre })
    .select('id').single();
  if (error) return { ok: false, error: error.message };

  await recordAudit(ctx, { action: 'module.lesson.create', resourceType: 'video_lesson', resourceId: data.id, severity: 'info' });
  revalidatePath('/admin/formations/modules');
  revalidatePath('/formations/modules');
  return { ok: true };
}

/** Met à jour le titre et/ou le lien vidéo d'une leçon. */
export async function updateLesson(lessonId: string, formData: FormData): Promise<Result> {
  const ctx = await requirePermission('content.write');
  const titre = String(formData.get('titre') ?? '').trim();
  const lien = String(formData.get('lien') ?? '').trim();
  const patch: Record<string, unknown> = {};
  if (titre) patch.titre = titre;
  if (lien) {
    const parsed = parseVideoUrl(lien);
    if (!parsed) return { ok: false, error: 'Lien vidéo non reconnu' };
    patch.provider = parsed.provider;
    patch.video_url = parsed.video_url;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Rien à modifier' };

  const sb = getServiceClient();
  const { error } = await sb.from('video_lessons').update(patch).eq('id', lessonId);
  if (error) return { ok: false, error: error.message };
  await recordAudit(ctx, { action: 'module.lesson.update', resourceType: 'video_lesson', resourceId: lessonId, severity: 'info' });
  revalidatePath('/admin/formations/modules');
  revalidatePath('/formations/modules');
  return { ok: true };
}

/** Supprime une leçon. */
export async function deleteLesson(lessonId: string): Promise<Result> {
  const ctx = await requirePermission('content.write');
  const sb = getServiceClient();
  const { error } = await sb.from('video_lessons').delete().eq('id', lessonId);
  if (error) return { ok: false, error: error.message };
  await recordAudit(ctx, { action: 'module.lesson.delete', resourceType: 'video_lesson', resourceId: lessonId, severity: 'warning' });
  revalidatePath('/admin/formations/modules');
  revalidatePath('/formations/modules');
  return { ok: true };
}
