'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { individualHtml, textToHtml } from '@/lib/email/templates';
import { validateUploads } from '@/lib/email/uploads';

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

/* ── Actions sur le compte (suspension, suppression, accès) ─────────────────
 *
 * Garde-fous communs, appliqués à TOUTES les actions destructrices :
 *  1. un admin ne peut pas s'appliquer l'action à lui-même (il se verrouillerait
 *     hors de la console, sans personne pour le débloquer) ;
 *  2. on ne peut pas viser un super-admin (sinon deux admins peuvent se
 *     neutraliser mutuellement, ou un rôle intermédiaire décapite la plateforme).
 */
async function guardTarget(
  ctx: { userId: string },
  targetId: string,
): Promise<string | null> {
  if (ctx.userId === targetId) return 'Vous ne pouvez pas appliquer cette action à votre propre compte.';

  const db = getServiceClient();
  const { data } = await db
    .from('admin_user_roles')
    .select('admin_roles(code)')
    .eq('user_id', targetId);

  // Le join to-one peut être typé objet OU tableau selon le client — accès souple.
  const isSuper = ((data ?? []) as unknown[]).some((row) => {
    const rel = (row as { admin_roles?: unknown }).admin_roles;
    const one = Array.isArray(rel) ? rel[0] : rel;
    return (one as { code?: string } | null)?.code === 'super_admin';
  });
  if (isSuper) return 'Action impossible sur un super administrateur.';
  return null;
}

/**
 * Suspend (ou réactive) un compte.
 *
 * Implémenté via `ban_duration` de l'API Admin Supabase : le compte ne peut plus
 * se connecter ET ses sessions en cours sont invalidées — une suspension qui
 * laisserait l'utilisateur agir jusqu'à expiration de son jeton ne suspendrait rien.
 */
export async function setSuspended(userId: string, suspended: boolean): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const blocked = await guardTarget(ctx, userId);
  if (blocked) return { ok: false, message: blocked };

  const db = getServiceClient();
  const { error } = await db.auth.admin.updateUserById(userId, {
    // '876000h' ≈ 100 ans (Supabase n'a pas de bannissement « infini » explicite) ;
    // 'none' lève la suspension.
    ban_duration: suspended ? '876000h' : 'none',
  });
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: suspended ? 'user.suspend' : 'user.unsuspend',
    resourceType: 'user',
    resourceId: userId,
    targetUserId: userId,
    severity: 'critical',
    metadata: { suspended },
  });

  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

/**
 * Supprime définitivement un compte et ses données (droit à l'effacement).
 *
 * `confirmEmail` doit correspondre exactement à l'email du compte : une
 * suppression irréversible ne doit jamais tenir à un seul clic.
 * La cascade FK purge les données liées ; `billing_transactions.user_id` passe à
 * NULL (justificatif comptable conservé mais anonymisé) — même logique que
 * /api/account/delete, côté utilisateur.
 */
export async function deleteUser(userId: string, confirmEmail: string): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const blocked = await guardTarget(ctx, userId);
  if (blocked) return { ok: false, message: blocked };

  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = (profile?.email as string | undefined) ?? null;

  if (!email || confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "L'email de confirmation ne correspond pas au compte." };
  }

  // Traçage AVANT la suppression : après, l'email n'existe plus nulle part.
  await recordAudit(ctx, {
    action: 'user.delete',
    resourceType: 'user',
    resourceId: userId,
    targetUserId: userId,
    severity: 'critical',
    metadata: { email },
  });

  // Consentement marketing : clé naturelle = email (pas de cascade FK).
  await db.from('newsletter_subscribers').delete().eq('email', email);
  await db.from('notification_prefs').delete().eq('user_id', userId);

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}

/** Change l'email de connexion (confirmé d'office : c'est un acte d'admin). */
export async function updateUserEmail(userId: string, newEmail: string): Promise<R> {
  const ctx = await requirePermission('users.write');
  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: 'Adresse email invalide.' };
  }

  const db = getServiceClient();
  const { data: current } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();

  const { error } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) return { ok: false, message: error.message };

  // `profiles.email` est une copie dénormalisée : sans cette mise à jour, la
  // console afficherait l'ancienne adresse et les emails partiraient au mauvais endroit.
  await db.from('profiles').update({ email, updated_at: new Date().toISOString() }).eq('id', userId);

  await recordAudit(ctx, {
    action: 'user.email_change',
    resourceType: 'user',
    resourceId: userId,
    targetUserId: userId,
    severity: 'critical', // l'email est le facteur de récupération du compte
    metadata: { from: (current?.email as string) ?? null, to: email },
  });

  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

/** Déconnecte le compte de tous ses appareils (révoque les sessions). */
export async function signOutUser(userId: string): Promise<R> {
  const ctx = await requirePermission('users.write');

  const db = getServiceClient();
  const { error } = await db.auth.admin.signOut(userId, 'global');
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: 'user.signout_all',
    resourceType: 'user',
    resourceId: userId,
    targetUserId: userId,
    severity: 'warning',
  });

  return { ok: true };
}

/**
 * Envoie un lien de réinitialisation de mot de passe.
 * L'admin ne CHOISIT jamais le mot de passe : il ne doit pas connaître le secret
 * d'un utilisateur (et pouvoir agir en son nom sans trace).
 */
export async function sendPasswordReset(userId: string): Promise<R> {
  const ctx = await requirePermission('users.write');

  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = profile?.email as string | undefined;
  if (!email) return { ok: false, message: "Email de l'utilisateur introuvable." };

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com'}/login`,
  });
  if (error) return { ok: false, message: error.message };

  await recordAudit(ctx, {
    action: 'user.password_reset',
    resourceType: 'user',
    resourceId: userId,
    targetUserId: userId,
    severity: 'warning',
    metadata: { email },
  });

  return { ok: true };
}

const USER_EMAIL_ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'];
const USER_EMAIL_MAX_TOTAL = 8 * 1024 * 1024;
const USER_EMAIL_MAX_FILES = 5;

export async function sendUserEmail(formData: FormData): Promise<R> {
  const ctx = await requirePermission('users.write');
  const userId = String(formData.get('userId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!userId) return { ok: false, message: 'Utilisateur manquant.' };
  if (!subject || !body) return { ok: false, message: 'Sujet et corps requis.' };

  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  const v = validateUploads(files.map((f) => ({ name: f.name, type: f.type, size: f.size })), {
    maxFiles: USER_EMAIL_MAX_FILES, maxTotalBytes: USER_EMAIL_MAX_TOTAL, allowed: USER_EMAIL_ALLOWED,
  });
  if (!v.ok) return { ok: false, message: v.message };

  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  const email = profile?.email as string | undefined;
  if (!email) return { ok: false, message: 'Email de l’utilisateur introuvable.' };

  const attachments = await Promise.all(
    files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()).toString('base64') })),
  );
  const res = await sendEmail({
    to: email, subject, html: individualHtml(textToHtml(body)),
    ...(attachments.length ? { attachments } : {}),
  });
  await recordAudit(ctx, {
    action: 'email.individual', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'info',
    metadata: { subject, attachments: files.map((f) => f.name), ok: res.ok, error: res.error ?? null },
  });
  return res.ok ? { ok: true } : { ok: false, message: res.error ?? 'Échec de l’envoi.' };
}
