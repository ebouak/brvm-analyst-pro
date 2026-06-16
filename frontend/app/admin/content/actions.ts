'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { CONTENT_KINDS, type ContentKind } from '@/lib/admin/content';

type R = { ok: boolean; message?: string };

export async function setHidden(kind: ContentKind, id: string, hidden: boolean): Promise<R> {
  const ctx = await requirePermission('content.write');
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  const { error } = await getServiceClient().from(cfg.table).update({ hidden }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: hidden ? 'content.hide' : 'content.show', resourceType: kind, resourceId: id, severity: 'info' });
  revalidatePath('/admin/content');
  return { ok: true };
}

export async function deleteContent(kind: ContentKind, id: string): Promise<R> {
  const ctx = await requirePermission('content.write');
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  const { error } = await getServiceClient().from(cfg.table).delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'content.delete', resourceType: kind, resourceId: id, severity: 'warning' });
  revalidatePath('/admin/content');
  return { ok: true };
}

/** Édite (id) ou crée (id=null) une entrée. Crée : created_by + dedupe_hash + défauts. */
export async function upsertContent(kind: ContentKind, id: string | null, fields: Record<string, string>): Promise<R> {
  const cfg = CONTENT_KINDS[kind];
  if (!cfg) return { ok: false, message: 'Type inconnu.' };
  for (const f of cfg.fields) {
    if (f.required && !(fields[f.key] ?? '').trim()) return { ok: false, message: `${f.label} requis.` };
  }
  const payload: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    const v = fields[f.key];
    if (v !== undefined) payload[f.key] = v === '' ? null : v;
  }
  const db = getServiceClient();
  if (id) {
    const ctx = await requirePermission('content.write');
    const { error } = await db.from(cfg.table).update(payload).eq('id', id);
    if (error) return { ok: false, message: error.message };
    await recordAudit(ctx, { action: 'content.update', resourceType: kind, resourceId: id, severity: 'info' });
  } else {
    const ctx = await requirePermission('content.publish');
    payload.created_by = ctx.userId;
    payload.dedupe_hash = `manual-${crypto.randomUUID()}`;
    if (kind === 'news') payload.source = 'autre';
    if (kind === 'communique' || kind === 'bulletin') payload.source_url = payload.source_url ?? '';
    const { error } = await db.from(cfg.table).insert(payload);
    if (error) return { ok: false, message: error.message };
    await recordAudit(ctx, { action: 'content.create', resourceType: kind, severity: 'info' });
  }
  revalidatePath('/admin/content');
  return { ok: true };
}
