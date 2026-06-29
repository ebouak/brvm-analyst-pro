'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

type R = { ok: boolean; message?: string };

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
