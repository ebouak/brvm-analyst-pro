'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { recomputeMemberPremium } from '@/lib/admin/orgPremium';

type R = { ok: boolean; message?: string };
const ROLES = ['owner', 'admin', 'member'];

async function resolveUserByEmail(email: string): Promise<string | null> {
  const { data } = await getServiceClient()
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function refresh(id?: string) {
  revalidatePath('/admin/organizations');
  if (id) revalidatePath(`/admin/organizations/${id}`);
}

/* ── Organisations ──────────────────────────────────────────────────────── */

export async function createOrganization(input: { name: string; ownerEmail?: string }): Promise<R> {
  const ctx = await requirePermission('users.write');
  const name = input.name?.trim();
  if (!name) return { ok: false, message: 'Nom requis.' };

  let ownerId: string | null = null;
  if (input.ownerEmail?.trim()) {
    ownerId = await resolveUserByEmail(input.ownerEmail);
    if (!ownerId) return { ok: false, message: 'Propriétaire introuvable (email inconnu).' };
  }

  const db = getServiceClient();
  const { data, error } = await db.from('organizations').insert({ name, owner_user_id: ownerId }).select('id').single();
  if (error) return { ok: false, message: error.message };
  const orgId = (data as { id: string }).id;

  if (ownerId) {
    await db.from('organization_members').insert({ organization_id: orgId, user_id: ownerId, role: 'owner' });
    await recomputeMemberPremium(ownerId);
  }
  await recordAudit(ctx, { action: 'org.create', resourceType: 'organization', resourceId: orgId, severity: 'info', metadata: { name } });
  refresh();
  return { ok: true };
}

export async function renameOrganization(id: string, name: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  const n = name?.trim();
  if (!n) return { ok: false, message: 'Nom requis.' };
  const { error } = await getServiceClient().from('organizations').update({ name: n }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'org.update', resourceType: 'organization', resourceId: id, severity: 'info', metadata: { name: n } });
  refresh(id);
  return { ok: true };
}

export async function deleteOrganization(id: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  const db = getServiceClient();
  const { data: members } = await db.from('organization_members').select('user_id').eq('organization_id', id);
  const userIds = (members ?? []).map((m) => (m as { user_id: string }).user_id);

  const { error } = await db.from('organizations').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };

  for (const uid of userIds) await recomputeMemberPremium(uid);
  await recordAudit(ctx, { action: 'org.delete', resourceType: 'organization', resourceId: id, severity: 'warning' });
  refresh();
  return { ok: true };
}

/* ── Membres ────────────────────────────────────────────────────────────── */

export async function addMember(orgId: string, email: string, role: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!ROLES.includes(role)) return { ok: false, message: 'Rôle invalide.' };
  const userId = await resolveUserByEmail(email);
  if (!userId) return { ok: false, message: 'Utilisateur introuvable (email inconnu).' };

  const db = getServiceClient();
  const { data: existing } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { ok: false, message: 'Déjà membre de cette organisation.' };

  const { error } = await db.from('organization_members').insert({ organization_id: orgId, user_id: userId, role });
  if (error) return { ok: false, message: error.message };

  await recomputeMemberPremium(userId);
  await recordAudit(ctx, { action: 'org.member.add', resourceType: 'organization', resourceId: orgId, targetUserId: userId, severity: 'info', metadata: { role } });
  refresh(orgId);
  return { ok: true };
}

export async function removeMember(orgId: string, userId: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  const { error } = await getServiceClient()
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) return { ok: false, message: error.message };

  await recomputeMemberPremium(userId);
  await recordAudit(ctx, { action: 'org.member.remove', resourceType: 'organization', resourceId: orgId, targetUserId: userId, severity: 'warning' });
  refresh(orgId);
  return { ok: true };
}

export async function setMemberRole(orgId: string, userId: string, role: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  if (!ROLES.includes(role)) return { ok: false, message: 'Rôle invalide.' };
  const { error } = await getServiceClient()
    .from('organization_members')
    .update({ role })
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'org.member.role', resourceType: 'organization', resourceId: orgId, targetUserId: userId, severity: 'info', metadata: { role } });
  refresh(orgId);
  return { ok: true };
}

/* ── Abonnement ─────────────────────────────────────────────────────────── */

async function recomputeAllMembers(orgId: string) {
  const { data: members } = await getServiceClient().from('organization_members').select('user_id').eq('organization_id', orgId);
  for (const m of (members ?? []) as { user_id: string }[]) await recomputeMemberPremium(m.user_id);
}

export async function linkSubscription(orgId: string, subscriptionId: string): Promise<R> {
  const ctx = await requirePermission('subscriptions.write');
  const { error } = await getServiceClient()
    .from('subscriptions')
    .update({ organization_id: orgId })
    .eq('id', subscriptionId);
  if (error) return { ok: false, message: error.message };
  await recomputeAllMembers(orgId);
  await recordAudit(ctx, { action: 'org.sub.link', resourceType: 'organization', resourceId: orgId, severity: 'info', metadata: { subscriptionId } });
  refresh(orgId);
  return { ok: true };
}

export async function unlinkSubscription(orgId: string, subscriptionId: string): Promise<R> {
  const ctx = await requirePermission('subscriptions.write');
  const { error } = await getServiceClient()
    .from('subscriptions')
    .update({ organization_id: null })
    .eq('id', subscriptionId);
  if (error) return { ok: false, message: error.message };
  await recomputeAllMembers(orgId);
  await recordAudit(ctx, { action: 'org.sub.unlink', resourceType: 'organization', resourceId: orgId, severity: 'warning', metadata: { subscriptionId } });
  refresh(orgId);
  return { ok: true };
}
