// frontend/app/admin/crm/actionsMasse.ts — relance e-mail en masse : tri serveur + envoi à l'unité (le client boucle).
'use server';
import { requirePermission } from '@/lib/server/rbac';
import { chargerDossier, chargerDossiers } from '@/lib/crm/charger';
import { chargerReglages } from '@/lib/crm/reglagesServeur';
import { classerPourMasse, MAX_SELECTION_MASSE, type TriMasse } from '@/lib/crm/masse';
import { choisirGabarit, composerRelance } from '@/lib/crm/gabarits';
import { scorer } from '@/lib/crm/score';
import { envoyerRelanceEmail } from '@/lib/crm/envoiRelance';

const nettoyer = (cles: unknown): string[] => (Array.isArray(cles) ? cles.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length < 300) : []).slice(0, MAX_SELECTION_MASSE);

/** Tri sur dossiers FRAIS : la liste du navigateur ne fait pas foi. Rien n'est envoyé ici. */
export async function preparerRelanceMasse(cles: string[]): Promise<TriMasse & { ok: boolean; message?: string }> {
  await requirePermission('crm.write');
  const liste = nettoyer(cles);
  if (liste.length === 0) return { ok: false, message: 'Aucune personne sélectionnée.', eligibles: [], ecartes: [] };
  try {
    const [dossiers, reglages] = await Promise.all([chargerDossiers(), chargerReglages()]);
    return { ok: true, ...classerPourMasse(liste, dossiers, reglages, new Date()) };
  } catch {
    return { ok: false, message: 'Chargement des dossiers impossible : rien n’est envoyé.', eligibles: [], ecartes: [] };
  }
}

/**
 * UNE relance de la série. Le dossier est rechargé, le gabarit rechoisi, et le cœur d'envoi (opposition, paiement,
 * éligibilité manuelle, anti-doublon 2 min) revérifie tout : un message ne part jamais sur la foi du tri précédent.
 */
export async function relancerUn(cle: string, inclureOffre: boolean): Promise<{ ok: boolean; message: string; statut: string }> {
  const ctx = await requirePermission('crm.write');
  if (typeof cle !== 'string' || !cle) return { ok: false, message: 'Personne invalide.', statut: 'refus' };
  const chargeLe = new Date().toISOString();
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.', statut: 'refus' };
  const templateId = choisirGabarit(d, scorer(d, new Date()));
  const { sujet, corps } = composerRelance(templateId, d);
  const r = await envoyerRelanceEmail({ d, sujet, corps, templateId, inclureOffre: Boolean(inclureOffre), auteur: ctx.userId, ctxAudit: ctx, masse: true, chargeLe });
  return { ok: r.ok, message: r.message, statut: r.statut };
}
