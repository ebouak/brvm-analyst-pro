'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { can, requireAdmin, type AdminContext } from '@/lib/server/rbac';

export interface OpenReport {
  id: string;
  target_type: 'topic' | 'post';
  target_id: string;
  reason: string | null;
  created_at: string;
}

export async function requireForumPermission(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx, 'forum.manage') && !can(ctx, 'content.write')) {
    redirect('/admin');
  }
  return ctx;
}

export async function listOpenReports(): Promise<OpenReport[]> {
  await requireForumPermission();
  const admin = getServiceClient();
  const { data } = await admin
    .from('forum_reports')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  return (data ?? []) as OpenReport[];
}

export async function setHidden(
  targetType: 'topic' | 'post',
  targetId: string,
  hidden: boolean,
) {
  await requireForumPermission();
  const admin = getServiceClient();
  const table = targetType === 'topic' ? 'forum_topics' : 'forum_posts';
  await admin.from(table).update({ hidden }).eq('id', targetId);
  revalidatePath('/admin/forum');
  return { ok: true };
}

export async function resolveReport(id: string) {
  await requireForumPermission();
  const admin = getServiceClient();
  await admin.from('forum_reports').update({ resolved: true }).eq('id', id);
  revalidatePath('/admin/forum');
  return { ok: true };
}
