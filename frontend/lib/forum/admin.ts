'use server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { requirePermission } from '@/lib/server/rbac';
import { revalidatePath } from 'next/cache';

export interface OpenReport {
  id: string;
  target_type: 'topic' | 'post';
  target_id: string;
  reason: string | null;
  created_at: string;
}

export async function listOpenReports(): Promise<OpenReport[]> {
  await requirePermission('content.write');
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
  await requirePermission('content.write');
  const admin = getServiceClient();
  const table = targetType === 'topic' ? 'forum_topics' : 'forum_posts';
  await admin.from(table).update({ hidden }).eq('id', targetId);
  revalidatePath('/admin/forum');
  return { ok: true };
}

export async function resolveReport(id: string) {
  await requirePermission('content.write');
  const admin = getServiceClient();
  await admin.from('forum_reports').update({ resolved: true }).eq('id', id);
  revalidatePath('/admin/forum');
  return { ok: true };
}
