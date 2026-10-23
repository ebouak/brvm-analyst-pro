'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { genererBrouillon } from '@/lib/contact/brouillon';
import { validerBrouillon, ADRESSE_SUPPORT } from '@/lib/contact/validerBrouillon';
import { renduReponse } from '@/lib/contact/rendu';
import { produitParCode } from '@/lib/billing/chariow/catalogue';
import { CODE_FORMATION } from '@/lib/billing/chariow/regles';

/**
 * Actions de la console /admin/contact. Toutes passent par requirePermission
 * et le service_role (table sans policy). Aucun contenu de message n'est
 * écrit dans l'audit : seulement l'action et l'identifiant.
 */

const EXPEDITEUR = `WESTBOURSE <${ADRESSE_SUPPORT}>`;

type Retour = { ok: true; brouillon?: string } | { ok: false; message: string };

export async function genererBrouillonAction(id: string): Promise<Retour> {
  await requirePermission('support.reply');
  const db = getServiceClient();
  const { data: m } = await db
    .from('contact_messages')
    .select('prenom, page, message, statut')
    .eq('id', id)
    .maybeSingle();
  if (!m) return { ok: false, message: 'Message introuvable.' };

  const r = await genererBrouillon(db, { prenom: m.prenom, page: m.page, message: m.message });
  if (!r.brouillon) return { ok: false, message: `Brouillon non généré : ${'raison' in r ? r.raison : 'raison inconnue'}` };

  await db
    .from('contact_messages')
    .update({ brouillon: r.brouillon, brouillon_at: new Date().toISOString() })
    .eq('id', id);
  return { ok: true, brouillon: r.brouillon };
}

export async function envoyerReponse(id: string, texte: string): Promise<Retour> {
  const ctx = await requirePermission('support.reply');

  // Revalidé ICI, côté serveur : le contrôle du navigateur n'est qu'un confort.
  const verdict = validerBrouillon(texte);
  if (!verdict.ok) return { ok: false, message: verdict.raison };

  const db = getServiceClient();
  // Transition conditionnelle : un seul appel gagne. Deux clics, ou deux
  // onglets, ne peuvent pas envoyer deux emails au même visiteur.
  const { data: m } = await db
    .from('contact_messages')
    .update({ statut: 'envoi' })
    .eq('id', id)
    .eq('statut', 'nouveau')
    .select('email, message, created_at')
    .maybeSingle();
  if (!m) return { ok: false, message: 'Ce message a déjà été traité ou est en cours d’envoi.' };

  // Offre lue au catalogue Chariow À L'ENVOI : prix et disponibilité ne
  // viennent jamais du texte (ni de l'IA, ni du navigateur). Inactive → pas de bloc.
  const produit = await produitParCode(CODE_FORMATION);
  const rendu = renduReponse({
    reponse: verdict.texte,
    messageOrigine: m.message,
    recuLe: m.created_at,
    offre: produit ? { montant: produit.montant, devise: produit.devise } : null,
  });
  const res = await sendEmail({
    to: m.email,
    from: EXPEDITEUR,
    replyTo: ADRESSE_SUPPORT,
    subject: rendu.subject,
    html: rendu.html,
    text: rendu.text,
  });

  const maintenant = new Date().toISOString();
  if (res.ok) {
    await db
      .from('contact_messages')
      .update({
        statut: 'repondu',
        reponse: verdict.texte,
        repondu_at: maintenant,
        repondu_par: ctx.userId,
        resend_id: res.id ?? null,
        derniere_activite_at: maintenant,
        // « Envoyé » n'est pas « reçu » : Resend fera progresser ce statut par
        // webhook (remis, rejeté, spam) — voir /api/webhooks/resend.
        livraison: 'envoye',
        livraison_at: maintenant,
      })
      .eq('id', id);
  } else {
    // Rien n'est parti : le message redevient « à répondre », jamais « répondu » à tort.
    await db.from('contact_messages').update({ statut: 'nouveau' }).eq('id', id);
  }

  await recordAudit(ctx, {
    action: 'contact.reply',
    resourceType: 'contact_message',
    resourceId: id,
    severity: res.ok ? 'info' : 'warning',
    metadata: { ok: res.ok, ...(res.ok ? {} : { erreur: res.error ?? 'inconnue' }) },
  });

  revalidatePath('/admin/contact');
  revalidatePath(`/admin/contact/${id}`);
  return res.ok ? { ok: true } : { ok: false, message: `Envoi refusé par le fournisseur : ${res.error ?? 'erreur inconnue'}` };
}

const TRANSITIONS: Record<string, string[]> = {
  clos: ['nouveau'],
  spam: ['nouveau'],
  nouveau: ['clos', 'spam'],
};

export async function changerStatut(id: string, statut: 'clos' | 'spam' | 'nouveau'): Promise<Retour> {
  const ctx = await requirePermission('support.reply');
  const depuis = TRANSITIONS[statut];
  if (!depuis) return { ok: false, message: 'Statut invalide.' };

  const { data, error } = await getServiceClient()
    .from('contact_messages')
    .update({ statut, derniere_activite_at: new Date().toISOString() })
    .eq('id', id)
    .in('statut', depuis)
    .select('id')
    .maybeSingle();

  await recordAudit(ctx, {
    action: 'contact.status_update',
    resourceType: 'contact_message',
    resourceId: id,
    severity: error ? 'warning' : 'info',
    metadata: { statut, ok: !error && !!data },
  });

  if (error || !data) return { ok: false, message: 'Changement de statut impossible depuis l’état actuel.' };
  revalidatePath('/admin/contact');
  revalidatePath(`/admin/contact/${id}`);
  return { ok: true };
}
