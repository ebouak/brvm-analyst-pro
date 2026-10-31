'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { creatorInfoTikTok, jetonTikTok, publierDirectTikTok, statutTikTok } from '@/lib/server/social';
import { postInfo, validerChoix, type ChoixPublication, type TypeContenu } from '@/lib/social/tiktokRegles';

type Resultat = { ok: true; publishId: string } | { ok: false; raison: string };

interface Contenu {
  type: TypeContenu;
  titre: string;
  description?: string;
  media: string[];
  duree_s?: number | null;
}

/** Seuls des médias servis par notre domaine VÉRIFIÉ partent chez TikTok. */
const MEDIA_AUTORISE = /^https:\/\/(www\.)?westbourse\.com\/api\//;

/**
 * Publie UNE publication préparée, après le choix explicite de l'exploitant.
 * Tout est revérifié ici, côté serveur : informations du compte relues,
 * règles TikTok rejouées, médias limités au domaine vérifié. La ligne passe
 * `en_cours` sous condition AVANT l'appel : un double clic ne publie pas deux fois.
 */
export async function publierTikTok(cible: string, cibleId: string, choix: ChoixPublication): Promise<Resultat> {
  const ctx = await requirePermission('content.publish');
  const db = getServiceClient();
  const { data: ligne } = await db
    .from('publications_sociales')
    .select('contenu, statut')
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .eq('reseau', 'tiktok')
    .maybeSingle();
  const contenu = ligne?.contenu as Contenu | null;
  if (!ligne || !contenu) return { ok: false, raison: 'Publication introuvable.' };
  if (!contenu.media?.length || !contenu.media.every((u) => MEDIA_AUTORISE.test(u))) return { ok: false, raison: 'Média hors du domaine vérifié.' };

  const jeton = await jetonTikTok();
  if (!jeton.ok) return { ok: false, raison: jeton.raison };
  let info;
  try {
    info = await creatorInfoTikTok(jeton.token);
  } catch (e) {
    return { ok: false, raison: `Le compte TikTok ne peut pas publier pour l’instant (${(e as Error).message}). Réessayez plus tard.` };
  }
  const v = validerChoix(choix, info, contenu.type, contenu.duree_s ?? null);
  if (!v.ok) return { ok: false, raison: v.raison };

  const { data: verrou } = await db
    .from('publications_sociales')
    .update({ statut: 'en_cours', erreur: null, lance_le: new Date().toISOString() })
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .eq('reseau', 'tiktok')
    .in('statut', ['a_valider', 'echec'])
    .select('cible_id');
  if (!verrou?.length) return { ok: false, raison: 'Déjà en cours ou déjà publiée.' };

  try {
    const publishId = await publierDirectTikTok(jeton.token, contenu.type, postInfo(choix, contenu.type), contenu.media);
    await db
      .from('publications_sociales')
      .update({ statut: 'publie', post_id: publishId, termine_le: new Date().toISOString() })
      .eq('cible', cible)
      .eq('cible_id', cibleId)
      .eq('reseau', 'tiktok');
    await recordAudit(ctx, {
      action: 'reseaux.tiktok.publication',
      resourceType: 'publications_sociales',
      resourceId: `${cible}:${cibleId}`,
      severity: 'warning',
      metadata: { visibilite: choix.visibilite, commercial: choix.commercial, publishId },
    });
    // PAS de revalidatePath ici : la page se rechargerait, la carte publiée
    // disparaîtrait de la liste et, avec elle, l'avis « le traitement prend
    // quelques minutes » et le suivi du statut — exigés par TikTok (règle 5).
    // Constaté le 2026-10-31 pendant l'enregistrement de la démonstration.
    return { ok: true, publishId };
  } catch (e) {
    const raison = (e as Error).message.slice(0, 300);
    await db
      .from('publications_sociales')
      .update({ statut: 'echec', erreur: raison, termine_le: new Date().toISOString() })
      .eq('cible', cible)
      .eq('cible_id', cibleId)
      .eq('reseau', 'tiktok');
    return { ok: false, raison: `TikTok a refusé la publication : ${raison}` };
  }
}

/** Règle 5 : suivi du traitement après publication. */
export async function statutPublicationTikTok(publishId: string): Promise<{ statut: string; raison: string | null } | null> {
  await requirePermission('content.publish');
  if (!/^[\w.-]{6,80}$/.test(publishId)) return null;
  const jeton = await jetonTikTok();
  if (!jeton.ok) return null;
  try {
    return await statutTikTok(jeton.token, publishId);
  } catch {
    return null;
  }
}

/** Écarte une publication préparée : elle ne partira pas. */
export async function ecarterTikTok(cible: string, cibleId: string): Promise<void> {
  const ctx = await requirePermission('content.publish');
  await getServiceClient()
    .from('publications_sociales')
    .update({ statut: 'ignore', erreur: 'écartée par l’exploitant', termine_le: new Date().toISOString() })
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .eq('reseau', 'tiktok')
    .in('statut', ['a_valider', 'echec']);
  await recordAudit(ctx, { action: 'reseaux.tiktok.ecarter', resourceType: 'publications_sociales', resourceId: `${cible}:${cibleId}`, severity: 'info' });
  revalidatePath('/admin/reseaux/tiktok');
}
