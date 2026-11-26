'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { individualHtml, siteUrl, textToHtml } from '@/lib/email/templates';
import { fermerToutesSessions } from '@/lib/securite/serveur';
import { emailAvertissement, emailSuspension } from '@/lib/securite/emails';

/**
 * Décisions humaines sur un compte (migration 0273). Chacune exige
 * `users.suspend`, un motif (interne, jamais envoyé à l'utilisateur), et laisse
 * une trace dans `securite_decisions` ET `admin_audit_logs`.
 *
 * Comptes d'administration hors périmètre : un administrateur ne sanctionne
 * pas un autre administrateur depuis cette console (cf. guardTarget de
 * /admin/users).
 */

type R = { ok: true; message?: string } | { ok: false; message: string };

function motifValide(m: string): string | null {
  const t = m.trim();
  return t.length >= 3 && t.length <= 500 ? t : null;
}

async function verifierCible(acteur: string, cible: string): Promise<string | null> {
  if (acteur === cible) return 'Action impossible sur votre propre compte.';
  const { data, error } = await getServiceClient().from('admin_user_roles').select('user_id').eq('user_id', cible).limit(1);
  if (error) return 'Rôles illisibles : action annulée.';
  if ((data ?? []).length > 0) return "Compte d'administration : hors du périmètre de cette console.";
  return null;
}

async function emailDe(userId: string): Promise<string | null> {
  const { data } = await getServiceClient().auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function decider(p: { userId: string; type: string; motif: string; jusquau: string | null; auteur: string }): Promise<string | null> {
  const { error } = await getServiceClient().from('securite_decisions').insert({
    user_id: p.userId, type: p.type, motif: p.motif, jusqu_au: p.jusquau, auteur: p.auteur,
  });
  return error ? error.message : null;
}

function rafraichir(userId: string) {
  revalidatePath('/admin/securite');
  revalidatePath(`/admin/securite/${userId}`);
}

export async function marquerLegitime(userId: string, motifSaisi: string): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const motif = motifValide(motifSaisi);
  if (!motif) return { ok: false, message: 'Motif requis (3 à 500 caractères).' };
  const jusquau = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const e = await decider({ userId, type: 'legitime', motif, jusquau, auteur: ctx.userId });
  if (e) return { ok: false, message: e };
  await recordAudit(ctx, { action: 'securite.legitime', resourceType: 'user', resourceId: userId, targetUserId: userId, metadata: { jusquau } });
  rafraichir(userId);
  return { ok: true, message: 'Marqué légitime pour 90 jours : le compte ne remonte plus dans les signaux.' };
}

export async function deconnecterCompte(userId: string, motifSaisi: string): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const motif = motifValide(motifSaisi);
  if (!motif) return { ok: false, message: 'Motif requis (3 à 500 caractères).' };
  const bloque = await verifierCible(ctx.userId, userId);
  if (bloque) return { ok: false, message: bloque };
  let fermees: number;
  try {
    fermees = await fermerToutesSessions(userId, 'admin');
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Fermeture impossible.' };
  }
  const e = await decider({ userId, type: 'deconnexion', motif, jusquau: null, auteur: ctx.userId });
  await recordAudit(ctx, { action: 'securite.deconnexion', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning', metadata: { sessions_fermees: fermees } });
  rafraichir(userId);
  return e ? { ok: false, message: `Sessions fermées (${fermees}), mais décision non enregistrée : ${e}` } : { ok: true, message: `${fermees} session(s) fermée(s).` };
}

export async function envoyerAvertissement(userId: string, motifSaisi: string): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const motif = motifValide(motifSaisi);
  if (!motif) return { ok: false, message: 'Motif requis (3 à 500 caractères).' };
  const bloque = await verifierCible(ctx.userId, userId);
  if (bloque) return { ok: false, message: bloque };
  const to = await emailDe(userId);
  if (!to) return { ok: false, message: 'Adresse e-mail introuvable.' };
  const m = emailAvertissement({ siteUrl: siteUrl() });
  const r = await sendEmail({ to, subject: m.sujet, html: individualHtml(textToHtml(m.texte)), text: m.texte, replyTo: 'support@westbourse.com' });
  if (!r.ok) return { ok: false, message: `E-mail non parti${r.incertain ? ' (issue incertaine : ne pas renvoyer tout de suite)' : ''} : ${r.error ?? 'erreur'}` };
  const e = await decider({ userId, type: 'avertissement', motif, jusquau: null, auteur: ctx.userId });
  await recordAudit(ctx, { action: 'securite.avertissement', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning', metadata: { resend_id: r.id ?? null } });
  rafraichir(userId);
  return e ? { ok: false, message: `E-mail parti, mais décision non enregistrée : ${e}` } : { ok: true, message: 'Avertissement envoyé.' };
}

export async function suspendrePremium(userId: string, motifSaisi: string, jours: number): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const motif = motifValide(motifSaisi);
  if (!motif) return { ok: false, message: 'Motif requis (3 à 500 caractères).' };
  if (![7, 30, 90, 0].includes(jours)) return { ok: false, message: 'Durée invalide.' };
  const bloque = await verifierCible(ctx.userId, userId);
  if (bloque) return { ok: false, message: bloque };
  const jusquau = jours > 0 ? new Date(Date.now() + jours * 86_400_000).toISOString() : null;
  const e = await decider({ userId, type: 'suspension', motif, jusquau, auteur: ctx.userId });
  if (e) return { ok: false, message: e };
  await recordAudit(ctx, { action: 'securite.suspension', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'critical', metadata: { jusquau } });

  // L'utilisateur est prévenu, avec une voie de contestation. Un échec d'envoi
  // ne lève pas la suspension : il est dit à l'administrateur.
  const to = await emailDe(userId);
  let info = 'Premium suspendu.';
  if (!to) info += ' Adresse introuvable : utilisateur NON prévenu.';
  else {
    const m = emailSuspension({ jusquau, siteUrl: siteUrl() });
    const r = await sendEmail({ to, subject: m.sujet, html: individualHtml(textToHtml(m.texte)), text: m.texte, replyTo: 'support@westbourse.com' });
    info += r.ok ? ' Utilisateur prévenu par e-mail.' : ` E-mail NON parti (${r.error ?? 'erreur'}) : prévenir l'utilisateur autrement.`;
  }
  rafraichir(userId);
  return { ok: true, message: info };
}

export async function leverSuspension(userId: string, motifSaisi: string): Promise<R> {
  const ctx = await requirePermission('users.suspend');
  const motif = motifValide(motifSaisi);
  if (!motif) return { ok: false, message: 'Motif requis (3 à 500 caractères).' };
  const e = await decider({ userId, type: 'levee', motif, jusquau: null, auteur: ctx.userId });
  if (e) return { ok: false, message: e };
  await recordAudit(ctx, { action: 'securite.levee', resourceType: 'user', resourceId: userId, targetUserId: userId, severity: 'warning' });
  rafraichir(userId);
  return { ok: true, message: 'Suspension levée : le Premium est rétabli.' };
}

export async function changerModePlafond(mode: 'off' | 'simulation' | 'actif'): Promise<R> {
  const ctx = await requirePermission('settings.write');
  if (!['off', 'simulation', 'actif'].includes(mode)) return { ok: false, message: 'Mode invalide.' };
  const { error } = await getServiceClient()
    .from('securite_reglages')
    .update({ mode, maj_le: new Date().toISOString(), maj_par: ctx.userId })
    .eq('id', true);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'securite.mode_plafond', resourceType: 'settings', resourceId: 'securite_reglages', severity: 'warning', metadata: { mode } });
  revalidatePath('/admin/securite');
  return { ok: true, message: `Plafond : ${mode === 'actif' ? 'actif' : mode === 'simulation' ? 'en simulation' : 'coupé'}.` };
}
