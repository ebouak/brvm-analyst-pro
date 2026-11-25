import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { alerterExploitant } from '@/lib/server/alerteExploitant';
import { blandConfigure, lancerAppelBland, lireAppelBland } from './bland';
import { cleFenetre, type TypeAlerte } from './fenetre';
import { estE164, hacherNumero } from './numero';
import { parametresAlerte, parametresTest, type ParametresAppel } from './script';
import { lireDetailBland, plafondJour, type StatutAppel } from './statut';

/**
 * Orchestration d'un appel vocal (table appels_vocaux, migration 0250,
 * service_role seul). Ordre imposé, pour ne JAMAIS appeler deux fois ni sans
 * trace :
 *   1. empreinte du numéro (secret exigé) ;
 *   2. opposition revérifiée JUSTE avant l'appel ;
 *   3. plafond de dépense du jour (tous motifs) ;
 *   4. INSERTION de la ligne `en_cours` (verrou : unique pour les alertes) ;
 *   5. POST Bland, puis mise à jour (call_id, ou `peut_etre_parti` / `echec`).
 * Aucun numéro en clair n'est écrit en base ni dans les journaux.
 */
type Db = SupabaseClient;

export type Motif = 'rappel_contact' | 'alerte_exploitant';

export type ResultatAppel =
  | { ok: true; appelId: string; callId: string }
  | { ok: false; raison: string; code: 'configuration' | 'opposition' | 'plafond' | 'deja' | 'base' | 'bland'; appelId?: string; statut?: StatutAppel };

export function debutJourUtc(maintenant: Date): string {
  return `${maintenant.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

/** Appels lancés depuis minuit UTC, tous motifs. LÈVE si la table est illisible. */
export async function compterAppelsDuJour(db: Db, maintenant = new Date()): Promise<number> {
  const { count, error } = await db
    .from('appels_vocaux')
    .select('id', { count: 'exact', head: true })
    .gte('cree_le', debutJourUtc(maintenant));
  if (error) throw new Error(`appels_vocaux illisible (${error.code ?? 'erreur'})`);
  return count ?? 0;
}

/** LÈVE si la table est illisible : une opposition non vérifiée ne vaut pas absence d'opposition. */
export async function estEnOpposition(db: Db, numeroHash: string): Promise<boolean> {
  const { data, error } = await db.from('oppositions_vocales').select('numero_hash').eq('numero_hash', numeroHash).maybeSingle();
  if (error) throw new Error(`oppositions_vocales illisible (${error.code ?? 'erreur'})`);
  return !!data;
}

export async function lancerAppel(
  db: Db,
  a: { motif: Motif; sourceId: string; numero: string; parametres: ParametresAppel; creePar?: string | null },
  maintenant = new Date(),
): Promise<ResultatAppel> {
  if (!blandConfigure()) return { ok: false, code: 'configuration', raison: 'BLAND_API_KEY absente.' };
  let hash: string;
  try {
    hash = hacherNumero(a.numero, process.env.BLAND_HASH_SECRET);
  } catch (e) {
    return { ok: false, code: 'configuration', raison: (e as Error).message };
  }

  try {
    if (await estEnOpposition(db, hash)) return { ok: false, code: 'opposition', raison: 'Ce numéro a demandé à ne plus être appelé.' };
    const max = plafondJour(process.env.VOIX_MAX_JOUR);
    if ((await compterAppelsDuJour(db, maintenant)) >= max) {
      return { ok: false, code: 'plafond', raison: `Plafond de ${max} appels par jour atteint.` };
    }
  } catch (e) {
    return { ok: false, code: 'base', raison: (e as Error).message };
  }

  const { data: ligne, error } = await db
    .from('appels_vocaux')
    .insert({ motif: a.motif, source_id: a.sourceId, numero_hash: hash, statut: 'en_cours', cree_par: a.creePar ?? null })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, code: 'deja', raison: 'Déjà appelé pour cette fenêtre.' };
    return { ok: false, code: 'base', raison: `enregistrement impossible (${error.code ?? 'erreur'})` };
  }
  const appelId = (ligne as { id: string }).id;

  const r = await lancerAppelBland(a.numero, a.parametres);
  const maj = new Date().toISOString();
  if (r.ok) {
    const { error: e2 } = await db.from('appels_vocaux').update({ bland_call_id: r.callId, maj_le: maj }).eq('id', appelId);
    if (e2) console.error('[voix] call_id non enregistré :', e2.code ?? 'erreur'); // l'appel est parti : on le dit
    return { ok: true, appelId, callId: r.callId };
  }
  const statut: StatutAppel = r.incertain ? 'peut_etre_parti' : 'echec';
  await db.from('appels_vocaux').update({ statut, erreur: r.erreur, maj_le: maj }).eq('id', appelId);
  return { ok: false, code: 'bland', raison: r.erreur, appelId, statut };
}

/**
 * Relit l'appel chez Bland et met la ligne à jour. Une demande « stop » dans
 * la transcription écrit l'opposition ; une transcription absente sur un appel
 * terminé est inscrite dans `erreur` (visible en console et en Tour de contrôle).
 */
export async function actualiserAppel(db: Db, appelId: string): Promise<{ ok: true; stop: boolean } | { ok: false; raison: string }> {
  const { data: l, error } = await db.from('appels_vocaux').select('id, bland_call_id, numero_hash').eq('id', appelId).maybeSingle();
  if (error) return { ok: false, raison: `lecture impossible (${error.code ?? 'erreur'})` };
  if (!l) return { ok: false, raison: 'Appel introuvable.' };
  if (!l.bland_call_id) return { ok: false, raison: 'Aucun identifiant Bland : l’appel n’a pas été confirmé, rien à relire.' };

  const r = await lireAppelBland(l.bland_call_id as string);
  if (!r.ok) return { ok: false, raison: `Bland : ${r.erreur}` };
  const lu = lireDetailBland(r.detail);

  if (lu.stop) {
    const { error: eo } = await db
      .from('oppositions_vocales')
      .upsert({ numero_hash: l.numero_hash, source: 'appel' }, { onConflict: 'numero_hash', ignoreDuplicates: true });
    if (eo) return { ok: false, raison: `STOP entendu mais opposition NON enregistrée (${eo.code ?? 'erreur'}) : l’enregistrer à la main.` };
  }

  const { error: eu } = await db
    .from('appels_vocaux')
    .update({
      statut: lu.statut,
      duree_min: lu.dureeMin,
      prix: lu.prix,
      fin_par: lu.finPar,
      transcription: lu.transcription,
      erreur: lu.transcriptionAbsente ? 'transcription absente' : null,
      maj_le: new Date().toISOString(),
    })
    .eq('id', appelId);
  if (eu) return { ok: false, raison: `mise à jour impossible (${eu.code ?? 'erreur'})` };
  return { ok: true, stop: lu.stop };
}

export type IssueAlerte = 'appele' | 'deja' | 'plafond' | 'non_configure' | 'echec';

/**
 * Usage 4 : appelle l'exploitant (BLAND_NUMERO_EXPLOITANT) pour une alerte
 * critique. Un seul appel par type et par fenêtre de 6 h (verrou en base).
 * Ne lève jamais : l'appelant mentionne l'issue dans son Telegram.
 */
export async function declencherAlerteVocale(type: TypeAlerte, resume: string, maintenant = new Date()): Promise<{ issue: IssueAlerte; detail: string }> {
  const numero = process.env.BLAND_NUMERO_EXPLOITANT?.trim();
  if (!estE164(numero)) return { issue: 'non_configure', detail: 'BLAND_NUMERO_EXPLOITANT absent ou non E.164' };
  let db: Db;
  try {
    db = getServiceClient();
  } catch (e) {
    return { issue: 'echec', detail: (e as Error).message };
  }
  const r = await lancerAppel(db, {
    motif: 'alerte_exploitant',
    sourceId: cleFenetre(type, maintenant),
    numero,
    parametres: parametresAlerte(type, resume),
  }, maintenant);
  if (r.ok) return { issue: 'appele', detail: 'appel lancé' };
  if (r.code === 'deja') return { issue: 'deja', detail: 'déjà appelé dans cette fenêtre de 6 h' };
  if (r.code === 'configuration') return { issue: 'non_configure', detail: r.raison };
  if (r.code === 'plafond') {
    // Telegram SEUL (jamais critique : pas de boucle d'appels).
    await alerterExploitant(`appel vocal d'alerte refusé : ${r.raison}`, '📞 Voix').catch(() => false);
    return { issue: 'plafond', detail: r.raison };
  }
  return { issue: 'echec', detail: r.statut === 'peut_etre_parti' ? `peut-être parti (${r.raison})` : r.raison };
}

/** Préfixe des `source_id` d'appels de test : distingue un test d'une vraie alerte. */
export const PREFIXE_TEST = 'test:';

/**
 * Appel de TEST vers l'exploitant, lancé à la main depuis /admin/controle.
 * Même chemin qu'une alerte (empreinte, opposition, plafond du jour, trace
 * avant l'appel), motif `alerte_exploitant` et `source_id` = `test:<minute>` :
 * l'index unique des alertes empêche deux tests dans la même minute (double clic).
 */
export async function lancerAppelTest(creePar: string, maintenant = new Date()): Promise<ResultatAppel> {
  const numero = process.env.BLAND_NUMERO_EXPLOITANT?.trim();
  if (!estE164(numero)) return { ok: false, code: 'configuration', raison: 'BLAND_NUMERO_EXPLOITANT absent ou non E.164.' };
  let db: Db;
  try {
    db = getServiceClient();
  } catch (e) {
    return { ok: false, code: 'configuration', raison: (e as Error).message };
  }
  return lancerAppel(db, {
    motif: 'alerte_exploitant',
    sourceId: `${PREFIXE_TEST}${maintenant.toISOString().slice(0, 16)}`,
    numero,
    parametres: parametresTest(),
    creePar,
  }, maintenant);
}
