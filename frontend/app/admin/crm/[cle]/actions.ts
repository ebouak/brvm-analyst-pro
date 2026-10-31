// frontend/app/admin/crm/[cle]/actions.ts
'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail, type EmailResult } from '@/lib/server/email';
import { ADRESSE_SUPPORT } from '@/lib/contact/validerBrouillon';
import { chargerDossier } from '@/lib/crm/charger';
import { estOppose, enregistrerOpposition } from '@/lib/crm/opposition';
import { scorer } from '@/lib/crm/score';
import { piedOpposition, versHtml, estTemplateId, type TemplateId } from '@/lib/crm/gabarits';

const EXPEDITEUR = `WESTBOURSE <${ADRESSE_SUPPORT}>`;
const SITE = 'https://www.westbourse.com';
type Retour = { ok: boolean; message: string };

export async function envoyerRelance(cle: string, sujet: string, corps: string, templateId: TemplateId): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  if (!estTemplateId(templateId)) return { ok: false, message: 'Gabarit inconnu.' };
  const s = String(sujet ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
  const c = String(corps ?? '').trim().slice(0, 5000);
  if (!s || !c) return { ok: false, message: 'Sujet et message obligatoires.' };
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  // Revérifiée ICI, pas seulement dans la liste (revue Fable). Échec fermé :
  // si la vérification elle-même échoue, on n'envoie RIEN.
  try {
    if (await estOppose(d.emailNorm)) return { ok: false, message: "Cette personne s'est opposée aux propositions commerciales : envoi refusé." };
  } catch {
    return { ok: false, message: "Vérification de l'opposition impossible : envoi annulé." };
  }

  if (d.premium || d.admin) return { ok: false, message: 'Personne Premium ou administratrice : relance refusée.' };

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).in('statut', ['envoi', 'envoye']).gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return { ok: false, message: "Une relance vient d'être envoyée ou est en cours pour cette personne." };

  const score = scorer(d, new Date());
  const jeton = randomBytes(24).toString('hex');
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'email', template_id: templateId,
    sujet: s, contenu: c, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'envoi',
    jeton_opposition: jeton, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) return { ok: false, message: 'Journal indisponible : envoi annulé.' };

  const texte = `${c}\n\n${piedOpposition(`${SITE}/crm/opposition?t=${jeton}`)}`;
  let res: EmailResult;
  try {
    res = await sendEmail({ to: d.emailNorm, subject: s, text: texte, html: versHtml(texte), from: EXPEDITEUR, replyTo: ADRESSE_SUPPORT });
  } catch (e) {
    // Une exception ne doit jamais laisser la ligne bloquée en « envoi ».
    res = { ok: false, sent: 0, error: (e as Error).message || 'exception' };
  }
  // L'échec est journalisé et affiché, jamais avalé (panne e-mail 07–09/2026).
  const { error: errMaj } = await sb.from('crm_actions').update(res.ok ? { statut: 'envoye', resend_id: res.id ?? null } : { statut: 'echec', erreur: (res.error ?? 'inconnue').slice(0, 300) }).eq('id', ligne.id);
  // Audit sans e-mail : identifiant de la ligne de journal, jamais la clé (qui embarque l'adresse).
  await recordAudit(ctx, { action: 'crm.relance', resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: res.ok ? 'info' : 'warning', metadata: { template: templateId, ok: res.ok, journal: !errMaj } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  if (res.ok && errMaj) return { ok: true, message: "Relance envoyée, mais le journal n'a pas pu être mis à jour." };
  return res.ok ? { ok: true, message: 'Relance envoyée.' } : { ok: false, message: `Échec de l'envoi : ${res.error ?? 'inconnu'}` };
}

export async function ajouterNote(cle: string, contenu: string): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const c = String(contenu ?? '').trim().slice(0, 2000);
  if (!c) return { ok: false, message: 'Note vide.' };
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  const { error } = await getServiceClient().from('crm_actions').insert({ email_norm: d.emailNorm, user_id: d.userId, type: 'note', contenu: c, statut: 'note', auteur: ctx.userId });
  if (error) return { ok: false, message: 'Note non enregistrée.' };
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return { ok: true, message: 'Note ajoutée.' };
}

export async function opposerParAdmin(cle: string): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  const ok = await enregistrerOpposition(d.emailNorm, 'admin');
  await recordAudit(ctx, { action: 'crm.opposition', resourceType: 'crm_contact', resourceId: d.userId ?? 'prospect', targetUserId: d.userId ?? undefined, severity: 'info', metadata: { ok } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return ok ? { ok: true, message: 'Opposition enregistrée.' } : { ok: false, message: 'Échec.' };
}
