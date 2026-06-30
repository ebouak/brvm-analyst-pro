'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { getCourseContent } from '@/lib/academy/server';
import { renderCourseHtml } from '@/lib/academy/template';
import { courseContentSchema } from '@/lib/academy/types';

type R = { ok: boolean; message?: string };

/**
 * Met à jour le contenu d'un cours (édition manuelle), le valide (zod) puis
 * re-rend le HTML — SANS rappeler le LLM. Conserve la couverture si l'éditeur
 * ne l'a pas renvoyée.
 */
export async function updateCourseContent(slug: string, rawContent: unknown): Promise<R> {
  const ctx = await requirePermission('content.write');

  const parsed = courseContentSchema.safeParse(rawContent);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: `Contenu invalide : ${first?.path.join('.')} — ${first?.message}` };
  }
  const content = parsed.data;

  // Préserver la couverture existante si absente du contenu édité.
  if (!content.coverUrl) {
    const existing = await getCourseContent(slug);
    if (existing?.coverUrl) content.coverUrl = existing.coverUrl;
  }

  const html = renderCourseHtml(content);
  const { error } = await getServiceClient()
    .from('academy_courses')
    .update({ titre: content.titre, niveau: content.niveau, resume: content.intro.slice(0, 280), content, html, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: 'academy.content.update',
    resourceType: 'academy_course',
    resourceId: slug,
    severity: 'info',
  });
  revalidatePath('/admin/academy');
  revalidatePath(`/formations/academy/${slug}`);
  return { ok: true };
}

/**
 * Définit (ou retire si url vide) la couverture d'un cours, puis re-rend le HTML
 * à partir du contenu stocké — SANS rappeler le LLM. La couverture est rangée
 * dans content.coverUrl → préservée lors d'une future régénération.
 */
export async function setCourseCover(slug: string, coverUrl: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const url = coverUrl.trim();
  if (url && !/^https:\/\/.+/i.test(url)) return { ok: false, message: 'URL invalide (https requis).' };

  const content = await getCourseContent(slug);
  if (!content) return { ok: false, message: 'Cours introuvable.' };

  content.coverUrl = url || null;
  const html = renderCourseHtml(content);

  const { error } = await getServiceClient()
    .from('academy_courses')
    .update({ content, html, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: url ? 'academy.cover.set' : 'academy.cover.remove',
    resourceType: 'academy_course',
    resourceId: slug,
    severity: 'info',
  });
  revalidatePath('/admin/academy');
  revalidatePath(`/formations/academy/${slug}`);
  return { ok: true };
}

export async function setCoursePublished(slug: string, published: boolean): Promise<R> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient()
    .from('academy_courses')
    .update({ published, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, {
    action: published ? 'academy.publish' : 'academy.unpublish',
    resourceType: 'academy_course',
    resourceId: slug,
    severity: 'info',
  });
  revalidatePath('/admin/academy');
  revalidatePath('/formations');
  return { ok: true };
}

export async function deleteCourse(slug: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient().from('academy_courses').delete().eq('slug', slug);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, {
    action: 'academy.delete',
    resourceType: 'academy_course',
    resourceId: slug,
    severity: 'warning',
  });
  revalidatePath('/admin/academy');
  revalidatePath('/formations');
  return { ok: true };
}
