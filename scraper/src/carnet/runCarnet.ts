import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { carnetDuBulletin, listerBulletins, type BulletinPublie } from './fetch.js';
import { spreadPct, type LigneCarnet } from './parse.js';

/**
 * Collecte du carnet d'ordres depuis le Bulletin Officiel de la Cote.
 *
 * Une exécution = un bulletin. Par défaut le plus récent publié ; `--date`
 * permet de rattraper une séance.
 *
 * Idempotent : upsert sur (code, date_marche). Relancer ne crée pas de doublon
 * et corrige une collecte partielle.
 *
 * Le bulletin paraît APRÈS la clôture, parfois le lendemain. Le collecteur ne
 * s'en émeut pas : il enregistre la séance que le bulletin déclare, et c'est
 * cette date qui fait foi en aval. Prétendre que le carnet est « celui de
 * maintenant » serait le seul vrai mensonge possible ici.
 */

export interface CarnetRunResult {
  date: string | null;
  lignes: number;
  avecFourchette: number;
  auMarche: number;
  ecrites: number;
  saute: boolean;
}

/** Ligne prête pour la base. Les zéros deviennent NULL : un carnet vide n'est pas un carnet à zéro. */
export function ligneVersBase(l: LigneCarnet, date: string) {
  const positifOuNull = (v: number | null) => (v == null || v <= 0 ? null : v);
  return {
    code: l.code,
    date_marche: date,
    designation: l.designation || null,
    qte_achat: positifOuNull(l.qteAchat),
    cours_achat: positifOuNull(l.coursAchat),
    qte_vente: positifOuNull(l.qteVente),
    cours_vente: positifOuNull(l.coursVente),
    achat_au_marche: l.achatAuMarche,
    vente_au_marche: l.venteAuMarche,
    cours_reference: positifOuNull(l.coursReference),
  };
}

export async function runCarnet(opts: { date?: string } = {}): Promise<CarnetRunResult> {
  const bulletins = await listerBulletins();
  if (bulletins.length === 0) throw new Error('aucun bulletin listé sur brvm.org');

  const cible: BulletinPublie | undefined = opts.date
    ? bulletins.find((b) => b.date === opts.date)
    : bulletins[0];
  if (!cible) throw new Error(`aucun bulletin publié pour la séance ${opts.date}`);

  const sb = getSupabase();

  // Déjà collecté ? On ne retélécharge pas un PDF d'un mégaoctet pour rien.
  const { count } = await sb
    .from('brvm_carnet_daily')
    .select('code', { count: 'exact', head: true })
    .eq('date_marche', cible.date);
  if ((count ?? 0) > 0 && !opts.date) {
    logger.info({ date: cible.date, lignes: count }, 'carnet déjà collecté, rien à faire');
    return { date: cible.date, lignes: count ?? 0, avecFourchette: 0, auMarche: 0, ecrites: 0, saute: true };
  }

  const lignes = await carnetDuBulletin(cible);
  if (lignes.length === 0) throw new Error(`carnet vide pour la séance ${cible.date} — page mal lue`);

  const rows = lignes.map((l) => ligneVersBase(l, cible.date));
  const { error } = await sb.from('brvm_carnet_daily').upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`écriture du carnet refusée : ${error.message}`);

  const res: CarnetRunResult = {
    date: cible.date,
    lignes: lignes.length,
    avecFourchette: lignes.filter((l) => spreadPct(l) != null).length,
    auMarche: lignes.filter((l) => l.achatAuMarche || l.venteAuMarche).length,
    ecrites: rows.length,
    saute: false,
  };
  logger.info(res, 'carnet d’ordres collecté');
  return res;
}
