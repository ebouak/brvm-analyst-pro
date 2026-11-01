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
import { decisionsCourantes } from '@/lib/crm/vues';
import { estOppose, enregistrerOpposition } from '@/lib/crm/opposition';
import { eligibilite } from '@/lib/crm/eligibilite';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { verifierPaiementAvantEnvoi } from '@/lib/crm/paiementServeur';
import { scorer } from '@/lib/crm/score';
import { estTemplateId, type TemplateId } from '@/lib/crm/gabarits';
import { construireEmailRelance } from '@/lib/crm/emailRelance';
import { estMotif, estUuid, validerEcheance, contenuCloture, contenuEcheance } from '@/lib/crm/decisions';
import { estAdministrateur } from '@/lib/crm/responsables';
import type { DecisionType, MotifCloture } from '@/lib/crm/types';
import { avecMentionStop, lienWaMeVers, texteOffre } from '@/lib/crm/whatsappRelance';

const EXPEDITEUR = `WESTBOURSE <${ADRESSE_SUPPORT}>`;
const SITE = 'https://www.westbourse.com';
type Retour = { ok: boolean; message: string };

export async function envoyerRelance(cle: string, sujet: string, corps: string, templateId: TemplateId, inclureOffre: boolean): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  if (!estTemplateId(templateId)) return { ok: false, message: 'Gabarit inconnu.' };
  const s = String(sujet ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
  const c = String(corps ?? '').trim().slice(0, 5000);
  if (!s || !c) return { ok: false, message: 'Sujet et message obligatoires.' };
  const chargeLe = new Date().toISOString();
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  // Revérifiée ICI, pas seulement dans la liste (revue Fable). Échec fermé :
  // si la vérification elle-même échoue, on n'envoie RIEN.
  try {
    if (await estOppose(d.emailNorm)) return { ok: false, message: "Cette personne s'est opposée aux propositions commerciales : envoi refusé." };
  } catch {
    return { ok: false, message: "Vérification de l'opposition impossible : envoi annulé." };
  }

  // Règle unique d'éligibilité (paiement, opposition, clôture, plafond, délai) : mêmes raisons que l'interface.
  const elig = eligibilite(d, await chargerReglages(), new Date());
  if (!elig.ok) return { ok: false, message: elig.raisons.join(' ; ') };
  // Dernier garde : la personne a pu payer depuis le chargement du dossier.
  const verif = await verifierPaiementAvantEnvoi(d.userId, chargeLe);
  if (!verif.ok) return { ok: false, message: verif.message };

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).in('statut', ['envoi', 'envoye', 'prepare']).gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return { ok: false, message: "Une relance vient d'être envoyée ou est en cours pour cette personne." };

  const score = scorer(d, new Date());
  const jeton = randomBytes(24).toString('hex');
  const jetonBonus = inclureOffre ? randomBytes(24).toString('hex') : null;
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'email', template_id: templateId,
    sujet: s, contenu: c, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'envoi',
    jeton_opposition: jeton, jeton_bonus: jetonBonus, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) return { ok: false, message: 'Journal indisponible : envoi annulé.' };

  let res: EmailResult;
  try {
    // La construction est DANS le try : elle échoue fermé (lien d'opposition invalide) et l'échec est journalisé.
    const { html, texte } = construireEmailRelance({
      corps: c,
      lienOpposition: `${SITE}/crm/opposition?t=${jeton}`,
      lienOffre: jetonBonus ? `${SITE}/offre/dossier?t=${jetonBonus}` : null,
      whatsappNumero: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || null,
      chaineWhatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_CHAINE_URL || null,
    });
    res = await sendEmail({ to: d.emailNorm, subject: s, text: texte, html, from: EXPEDITEUR, replyTo: ADRESSE_SUPPORT });
  } catch (e) {
    // Une exception ne doit jamais laisser la ligne bloquée en « envoi ».
    res = { ok: false, sent: 0, error: (e as Error).message || 'exception' };
  }
  // L'échec est journalisé et affiché, jamais avalé (panne e-mail 07–09/2026).
  const { error: errMaj } = await sb.from('crm_actions').update(res.ok ? { statut: 'envoye', resend_id: res.id ?? null } : { statut: 'echec', erreur: (res.error ?? 'inconnue').slice(0, 300) }).eq('id', ligne.id);
  // Audit sans e-mail : identifiant de la ligne de journal, jamais la clé (qui embarque l'adresse).
  await recordAudit(ctx, { action: 'crm.relance', resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: res.ok ? 'info' : 'warning', metadata: { template: templateId, ok: res.ok, journal: !errMaj, offre: Boolean(inclureOffre) } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  if (res.ok && errMaj) return { ok: true, message: "Relance envoyée, mais le journal n'a pas pu être mis à jour." };
  return res.ok ? { ok: true, message: 'Relance envoyée.' } : { ok: false, message: `Échec de l'envoi : ${res.error ?? 'inconnu'}` };
}

export async function preparerRelanceWhatsapp(cle: string, texte: string, templateId: TemplateId, inclureOffre: boolean): Promise<Retour & { url?: string }> {
  const ctx = await requirePermission('crm.write');
  if (!estTemplateId(templateId)) return { ok: false, message: 'Gabarit inconnu.' };
  const brut = String(texte ?? '').trim().slice(0, 1500);
  if (!brut) return { ok: false, message: 'Message vide.' };
  const chargeLe = new Date().toISOString();
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  try {
    if (await estOppose(d.emailNorm)) return { ok: false, message: "Cette personne s'est opposée aux propositions commerciales : rien n'est préparé." };
  } catch {
    return { ok: false, message: "Vérification de l'opposition impossible : rien n'est préparé." };
  }
  // Règle unique d'éligibilité (paiement, opposition, clôture, plafond, délai) : mêmes raisons que l'interface.
  const elig = eligibilite(d, await chargerReglages(), new Date());
  if (!elig.ok) return { ok: false, message: elig.raisons.join(' ; ') };
  // Dernier garde : la personne a pu payer depuis le chargement du dossier.
  const verif = await verifierPaiementAvantEnvoi(d.userId, chargeLe);
  if (!verif.ok) return { ok: false, message: verif.message };
  if (!d.whatsapp.recontact || !d.whatsapp.numero) return { ok: false, message: 'Pas de numéro avec consentement au recontact : relance WhatsApp impossible.' };

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).in('statut', ['envoi', 'envoye', 'prepare']).gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return { ok: false, message: "Une relance vient d'être faite pour cette personne." };

  const jetonBonus = inclureOffre ? randomBytes(24).toString('hex') : null;
  // Le lien d'offre est ajouté AU SERVEUR : le texte relu ne peut pas porter un jeton forgé.
  const message = avecMentionStop(jetonBonus ? `${brut}\n\n${texteOffre(`${SITE}/offre/dossier?t=${jetonBonus}`)}` : brut);
  const score = scorer(d, new Date());
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'whatsapp', template_id: templateId,
    sujet: null, contenu: message, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'prepare',
    jeton_bonus: jetonBonus, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) return { ok: false, message: "Journal indisponible : rien n'est préparé." };
  // Audit sans numéro ni e-mail.
  await recordAudit(ctx, { action: 'crm.relance_whatsapp', resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: 'info', metadata: { template: templateId, offre: Boolean(inclureOffre), source: d.whatsapp.source } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return { ok: true, message: 'Message prêt dans WhatsApp : relisez-le et envoyez-le depuis votre téléphone.', url: lienWaMeVers(d.whatsapp.numero, message) };
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

/**
 * Enregistre UNE décision humaine comme événement daté (jamais de mise à jour
 * d'une ligne existante : l'historique reste complet, la plus récente l'emporte).
 * Audit sans e-mail : identifiant de la ligne de journal seulement.
 */
async function enregistrerDecision(
  cle: string, decision: DecisionType, contenu: string,
  extra: { motif?: MotifCloture; echeance?: string; responsable?: string },
  refuser?: (d: NonNullable<Awaited<ReturnType<typeof chargerDossier>>>) => string | null,
): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  const refus = refuser?.(d);
  if (refus) return { ok: false, message: refus };
  const { data: ligne, error } = await getServiceClient().from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'decision', statut: 'decision', contenu, decision,
    motif: extra.motif ?? null, echeance: extra.echeance ?? null, responsable: extra.responsable ?? null, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) {
    console.error('[crm] décision non enregistrée :', error?.code ?? error?.message ?? 'aucune ligne retournée');
    return { ok: false, message: 'Décision non enregistrée.' };
  }
  await recordAudit(ctx, { action: `crm.${decision}`, resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: 'info', metadata: { decision, motif: extra.motif ?? null } });
  revalidatePath('/admin/crm');
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return { ok: true, message: 'Décision enregistrée.' };
}

export async function cloturer(cle: string, motif: MotifCloture): Promise<Retour> {
  await requirePermission('crm.write');
  if (!estMotif(motif)) return { ok: false, message: 'Motif de clôture inconnu.' };
  return enregistrerDecision(cle, 'cloture', contenuCloture(motif), { motif });
}

export async function rouvrir(cle: string): Promise<Retour> {
  return enregistrerDecision(cle, 'reouverture', 'Dossier rouvert', {}, (d) => (decisionsCourantes(d).cloture ? null : "Ce dossier n'est pas clôturé."));
}

export async function fixerEcheance(cle: string, dateIso: string): Promise<Retour> {
  await requirePermission('crm.write');
  const v = validerEcheance(dateIso, new Date());
  if (!v.ok) return { ok: false, message: v.message };
  return enregistrerDecision(cle, 'echeance', contenuEcheance(v.date), { echeance: v.date });
}

export async function assignerResponsable(cle: string, userId: string): Promise<Retour> {
  // Autorisation d'abord, validation ensuite : pas d'oracle pour un non-habilité.
  await requirePermission('crm.write');
  if (!estUuid(userId)) return { ok: false, message: 'Responsable invalide.' };
  if (!(await estAdministrateur(userId))) return { ok: false, message: "Ce compte n'est pas administrateur : assignation refusée." };
  return enregistrerDecision(cle, 'responsable', 'Responsable assigné', { responsable: userId });
}

export async function marquerReponse(cle: string): Promise<Retour> {
  return enregistrerDecision(cle, 'reponse', 'Réponse reçue (déclarée)', {});
}

export async function marquerTraite(cle: string): Promise<Retour> {
  return enregistrerDecision(cle, 'traite', 'Réponse traitée', {});
}
