'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { transitionAutorisee, type StatutInscription } from '@/lib/formations/regles';

export interface Resultat { ok: boolean; message: string }

export async function creerSession(formData: FormData): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();

  const titre = String(formData.get('titre') ?? '').trim();
  const niveau = String(formData.get('niveau') ?? 'debutant');
  const debut = String(formData.get('debut_at') ?? '');
  const duree = Number(formData.get('duree_min') ?? 240);
  const modalite = String(formData.get('modalite') ?? 'visio');
  const places = Number(formData.get('places') ?? 20);
  const prix = Number(formData.get('prix') ?? 0);
  const prixAbonneBrut = String(formData.get('prix_abonne') ?? '').trim();

  if (titre.length < 3) return { ok: false, message: 'Titre : 3 caractères au minimum.' };
  if (!debut || Number.isNaN(Date.parse(debut))) return { ok: false, message: 'Date de début invalide.' };
  if (!Number.isFinite(places) || places <= 0) return { ok: false, message: 'Nombre de places invalide.' };
  if (!Number.isFinite(prix) || prix < 0) return { ok: false, message: 'Prix invalide.' };

  const { data, error } = await db.from('formation_sessions').insert({
    titre, niveau, debut_at: new Date(debut).toISOString(), duree_min: duree, modalite,
    lieu: String(formData.get('lieu') ?? '').trim() || null,
    lien_visio: String(formData.get('lien_visio') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    places, prix,
    prix_abonne: prixAbonneBrut === '' ? null : Number(prixAbonneBrut),
    statut: 'brouillon',
    created_by: ctx.userId,
  }).select('id').single();
  if (error || !data) return { ok: false, message: `Création refusée : ${error?.message ?? 'inconnue'}` };

  await recordAudit(ctx, { action: 'formation.session_create', resourceType: 'formation_sessions', resourceId: data.id, severity: 'info' });
  revalidatePath('/admin/formations/sessions');
  revalidatePath('/formations/sessions');
  return { ok: true, message: 'Séance créée en brouillon.' };
}

export async function changerStatutSession(id: string, statut: string): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  if (!['brouillon', 'ouverte', 'complete', 'annulee', 'terminee'].includes(statut)) {
    return { ok: false, message: 'Statut inconnu.' };
  }
  const db = getServiceClient();
  const { error } = await db.from('formation_sessions').update({ statut }).eq('id', id);
  if (error) return { ok: false, message: 'Mise à jour refusée.' };

  // Annuler une séance annule les inscriptions : le trigger remet les places.
  if (statut === 'annulee') {
    await db.from('formation_inscriptions').update({ statut: 'annulee' }).eq('session_id', id).in('statut', ['reservee', 'payee']);
  }
  await recordAudit(ctx, { action: 'formation.session_statut', resourceType: 'formation_sessions', resourceId: id, severity: statut === 'annulee' ? 'warning' : 'info' });
  revalidatePath('/admin/formations/sessions');
  revalidatePath('/formations/sessions');
  return { ok: true, message: 'Statut mis à jour.' };
}

export async function marquerPresence(inscriptionId: string, statut: 'presente' | 'absente'): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();
  const { data: ins } = await db.from('formation_inscriptions').select('id, statut').eq('id', inscriptionId).maybeSingle();
  if (!ins) return { ok: false, message: 'Inscription introuvable.' };
  if (!transitionAutorisee(ins.statut as StatutInscription, statut)) {
    return { ok: false, message: `Une inscription « ${ins.statut} » ne peut pas passer à « ${statut} ».` };
  }
  const { error } = await db.from('formation_inscriptions').update({ statut }).eq('id', inscriptionId);
  if (error) return { ok: false, message: 'Mise à jour refusée.' };
  await recordAudit(ctx, { action: 'formation.presence', resourceType: 'formation_inscriptions', resourceId: inscriptionId, severity: 'info' });
  revalidatePath('/admin/formations/sessions');
  return { ok: true, message: 'Présence enregistrée.' };
}
