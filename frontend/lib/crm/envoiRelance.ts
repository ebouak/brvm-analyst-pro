import 'server-only';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail, type EmailResult } from '@/lib/server/email';
import { recordAudit } from '@/lib/server/audit';
import type { AdminContext } from '@/lib/server/rbac';
import { ADRESSE_SUPPORT } from '@/lib/contact/validerBrouillon';
import { estOppose } from '@/lib/crm/opposition';
import { eligibilite } from '@/lib/crm/eligibilite';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { verifierPaiementAvantEnvoi } from '@/lib/crm/paiementServeur';
import { scorer } from '@/lib/crm/score';
import { construireEmailRelance } from '@/lib/crm/emailRelance';
import type { TemplateId } from '@/lib/crm/gabarits';
import type { Dossier } from '@/lib/crm/types';

const EXPEDITEUR = `WESTBOURSE <${ADRESSE_SUPPORT}>`;
const SITE = 'https://www.westbourse.com';

export interface EntreeEnvoi {
  d: Dossier;
  sujet: string;
  corps: string;
  templateId: TemplateId;
  inclureOffre: boolean;
  /** user_id de l'exploitant ; null pour une séquence automatique. */
  auteur: string | null;
  /** Contexte d'audit admin (voie manuelle) ; absent pour le cron : sans session, le journal crm_actions fait foi. */
  ctxAudit?: AdminContext;
  /** `<séquence>:<étape>` — l'index unique de la base garantit « jamais deux fois ». */
  sequenceCle?: string;
  /** Écrit le journal (statut « simulation ») mais n'appelle JAMAIS sendEmail. */
  simulation?: boolean;
  /** Instant de chargement du dossier : un paiement postérieur doit bloquer l'envoi. */
  chargeLe: string;
}
export interface SortieEnvoi { ok: boolean; message: string; statut: 'envoye' | 'echec' | 'simulation' | 'refus'; journalId?: number | string }

/**
 * Cœur d'envoi d'une relance e-mail, commun à la voie manuelle et aux séquences.
 * Tout garde-fou vit ICI : aucune voie ne peut en contourner un. Échec fermé.
 */
export async function envoyerRelanceEmail(e: EntreeEnvoi): Promise<SortieEnvoi> {
  const { d, sujet: s, corps: c, templateId, inclureOffre } = e;
  const refus = (message: string): SortieEnvoi => ({ ok: false, message, statut: 'refus' });
  // Revérifiée ICI, pas seulement dans la liste (revue Fable). Échec fermé :
  // si la vérification elle-même échoue, on n'envoie RIEN.
  try {
    if (await estOppose(d.emailNorm)) return refus("Cette personne s'est opposée aux propositions commerciales : envoi refusé.");
  } catch {
    return refus("Vérification de l'opposition impossible : envoi annulé.");
  }

  // Règle unique d'éligibilité (paiement, opposition, clôture, plafond, délai) : mêmes raisons que l'interface.
  const elig = eligibilite(d, await chargerReglages(), new Date());
  if (!elig.ok) return refus(elig.raisons.join(' ; '));
  // Dernier garde : la personne a pu payer depuis le chargement du dossier.
  const verif = await verifierPaiementAvantEnvoi(d.userId, e.chargeLe);
  if (!verif.ok) return refus(verif.message);

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).in('statut', ['envoi', 'envoye', 'prepare']).gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return refus("Une relance vient d'être envoyée ou est en cours pour cette personne.");

  const score = scorer(d, new Date());
  const jeton = randomBytes(24).toString('hex');
  const jetonBonus = inclureOffre ? randomBytes(24).toString('hex') : null;
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'email', template_id: templateId,
    sujet: s, contenu: c, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'envoi',
    jeton_opposition: jeton, jeton_bonus: jetonBonus, auteur: e.auteur,
    ...(e.sequenceCle ? { sequence_cle: e.sequenceCle } : {}),
  }).select('id').single();
  // Violation d'unicité (email_norm, sequence_cle) : l'étape existe déjà — c'est la garantie d'idempotence.
  if (error?.code === '23505') return refus('Étape déjà traitée.');
  if (error || !ligne) return refus('Journal indisponible : envoi annulé.');

  if (e.simulation) {
    // Simulation : la ligne est écrite pour que l'étape ne soit pas rejouée, mais RIEN ne part.
    const { error: errSim } = await sb.from('crm_actions').update({ statut: 'simulation' }).eq('id', ligne.id);
    if (errSim) return { ok: false, message: 'Simulation non journalisée.', statut: 'echec', journalId: ligne.id };
    return { ok: true, message: 'Simulation (non envoyé).', statut: 'simulation', journalId: ligne.id };
  }

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
  } catch (err) {
    // Une exception ne doit jamais laisser la ligne bloquée en « envoi ».
    res = { ok: false, sent: 0, error: (err as Error).message || 'exception' };
  }
  // L'échec est journalisé et affiché, jamais avalé (panne e-mail 07–09/2026).
  const { error: errMaj } = await sb.from('crm_actions').update(res.ok ? { statut: 'envoye', resend_id: res.id ?? null, livraison: 'envoye' } : { statut: 'echec', erreur: (res.error ?? 'inconnue').slice(0, 300) }).eq('id', ligne.id);
  // Audit sans e-mail : identifiant de la ligne de journal, jamais la clé (qui embarque l'adresse).
  if (e.ctxAudit) {
    await recordAudit(e.ctxAudit, { action: 'crm.relance', resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: res.ok ? 'info' : 'warning', metadata: { template: templateId, ok: res.ok, journal: !errMaj, offre: Boolean(inclureOffre), sequence: e.sequenceCle ?? null, auteur: e.auteur } });
  }
  if (res.ok && errMaj) return { ok: true, message: "Relance envoyée, mais le journal n'a pas pu être mis à jour.", statut: 'envoye', journalId: ligne.id };
  return res.ok
    ? { ok: true, message: 'Relance envoyée.', statut: 'envoye', journalId: ligne.id }
    : { ok: false, message: `Échec de l'envoi : ${res.error ?? 'inconnu'}`, statut: 'echec', journalId: ligne.id };
}
