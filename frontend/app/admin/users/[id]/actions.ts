'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { individualHtml, textToHtml } from '@/lib/email/templates';

type R = { ok: boolean; message?: string };

/** Attribue ou révoque un rôle admin (réservé super_admin, journalisé). Factorise
 *  les deux chemins quasi identiques pour éviter toute divergence future. */
async function changeRole(userId: string, roleCode: string, op: 'assign' | 'revoke'): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!ctx.isSuperAdmin) return { ok: false, message: 'Réservé au super administrateur.' };
  const db = getServiceClient();
  const { data: role } = await db.from('admin_roles').select('id').eq('code', roleCode).maybeSingle();
  if (!role) return { ok: false, message: 'Rôle inconnu.' };
  const { error } =
    op === 'assign'
      ? await db
          .from('admin_user_roles')
          .upsert({ user_id: userId, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true })
      : await db.from('admin_user_roles').delete().eq('user_id', userId).eq('role_id', role.id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, {
    action: op === 'assign' ? 'role.assign' : 'role.revoke',
    resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning', metadata: { roleCode },
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function assignRole(userId: string, roleCode: string): Promise<R> {
  return changeRole(userId, roleCode, 'assign');
}

export async function revokeRole(userId: string, roleCode: string): Promise<R> {
  return changeRole(userId, roleCode, 'revoke');
}

export async function setPremium(userId: string, value: boolean): Promise<R> {
  const ctx = await requirePermission('users.write');
  const db = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('profiles')
    .update({ is_premium: value, premium_since: value ? nowIso : null, updated_at: nowIso })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'premium.set', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info', metadata: { value } });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function sendUserEmail(userId: string, subject: string, body: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!subject.trim() || !body.trim()) return { ok: false, message: 'Sujet et corps requis.' };
  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = profile?.email as string | undefined;
  if (!email) return { ok: false, message: "Email de l'utilisateur introuvable." };
  const res = await sendEmail({ to: email, subject, html: individualHtml(textToHtml(body)) });
  await recordAudit(ctx, { action: 'email.individual', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info', metadata: { subject, ok: res.ok, error: res.error ?? null } });
  return res.ok ? { ok: true } : { ok: false, message: res.error ?? "Échec de l'envoi." };
}
