'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { getCourseContent } from '@/lib/academy/server';
import { renderCourseHtml } from '@/lib/academy/template';

type R = { ok: boolean; message?: string };

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
