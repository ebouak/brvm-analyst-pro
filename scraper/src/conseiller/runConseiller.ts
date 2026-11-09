import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { chargerHistorique } from './historique.js';
import { indiceEquipondere } from './indice.js';
import { scoresFamilles } from './facteurs.js';
import { classeA } from './liquiditeGlissante.js';
import { lignesFacteurs, verifierEcriture, type LigneFacteurs } from './lignes.js';

/**
 * Positions par famille de facteurs pour la dernière séance (spec §12).
 * Sans `ecrire` : calcul et contrôle à blanc, rien n'est écrit.
 * Avec `ecrire` : upsert idempotent sur (date_marche, code), relecture, puis contrôle
 * sur la donnée RELUE. Une anomalie LÈVE : le run passe au rouge.
 */
export async function runConseiller(ecrire: boolean): Promise<{ date: string; lignes: number }> {
  const { donnees: d } = await chargerHistorique();
  const date = d.calendrier.at(-1);
  if (!date) throw new Error('aucune séance en base');
  const ind = indiceEquipondere(d);
  const scores = scoresFamilles(d, ind, date);
  const classes = new Map([...scores.keys()].map((c) => [c, classeA(d.series.get(c)!, d.calendrier, date)]));
  const lignes = lignesFacteurs(date, scores, classes);
  const nbCotees = scores.size;

  const aBlanc = verifierEcriture(lignes, date, nbCotees);
  if (aBlanc.length) throw new Error(`conseiller : lot invalide avant écriture — ${aBlanc.join(' ; ')}`);
  if (!ecrire) {
    logger.info({ date, lignes: lignes.length }, 'conseiller : calcul à blanc conforme (rien écrit)');
    return { date, lignes: lignes.length };
  }

  const sb = getSupabase();
  const { error } = await sb.from('conseiller_facteurs').upsert(lignes, { onConflict: 'date_marche,code' });
  if (error) throw new Error(`conseiller : écriture refusée — ${error.message}`);

  const { data: relues, error: eRelue } = await sb.from('conseiller_facteurs').select('*').eq('date_marche', date);
  if (eRelue) throw new Error(`conseiller : relecture impossible — ${eRelue.message}`);
  const anomalies = verifierEcriture((relues ?? []) as LigneFacteurs[], date, nbCotees);
  if (anomalies.length) throw new Error(`conseiller : contrôle sur la donnée relue — ${anomalies.join(' ; ')}`);
  logger.info({ date, lignes: relues?.length }, 'conseiller : positions écrites et vérifiées');
  return { date, lignes: relues?.length ?? 0 };
}
