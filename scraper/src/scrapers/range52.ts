/**
 * Plus-haut et plus-bas sur 52 semaines.
 *
 * POURQUOI CE MODULE EXISTE. Les colonnes `cours_haut_52s` et `cours_bas_52s`
 * de `brvm_actions_daily` (migration 0018) sont lues par une douzaine de
 * fichiers du frontend — fiche action, comparaison, impression, diagnostic —
 * et n'ont JAMAIS été alimentées : 0 ligne sur 48 640 au 2026-09-08.
 * L'interface promettait une donnée que rien ne produisait.
 *
 * Elle n'a pas à être collectée : elle se CALCULE depuis l'historique des
 * clôtures déjà en base. Aller la chercher chez un tiers aurait été ajouter
 * une source, donc une façon de plus de se tromper.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

export interface Cloture {
  code: string;
  cours_jour: number | null;
}

export interface Bornes52 {
  bas: number;
  haut: number;
  seances: number;
}

/**
 * Sous ce nombre de séances cotées, AUCUNE borne n'est produite.
 *
 * Sur un marché étroit comme la BRVM, beaucoup de valeurs ne cotent que
 * quelques jours par an. Annoncer « plus-bas 52 semaines » à partir de trois
 * points serait une affirmation sans fondement, et le lecteur n'aurait aucun
 * moyen de le savoir. Mieux vaut la case vide, que le frontend sait déjà
 * afficher.
 */
export const MIN_SEANCES = 20;

/** Calcule les bornes par code. PUR : aucune I/O. */
export function calculerBornes(lignes: Cloture[]): Map<string, Bornes52> {
  const parCode = new Map<string, number[]>();
  for (const l of lignes) {
    const c = l.cours_jour == null ? null : Number(l.cours_jour);
    if (c == null || !Number.isFinite(c) || c <= 0) continue;
    const liste = parCode.get(l.code);
    if (liste) liste.push(c);
    else parCode.set(l.code, [c]);
  }

  const out = new Map<string, Bornes52>();
  for (const [code, cours] of parCode) {
    if (cours.length < MIN_SEANCES) continue;
    let bas = cours[0]!;
    let haut = cours[0]!;
    for (const c of cours) {
      if (c < bas) bas = c;
      if (c > haut) haut = c;
    }
    out.set(code, { bas, haut, seances: cours.length });
  }
  return out;
}

export interface Range52RunResult {
  status: 'success' | 'failed' | 'mock';
  date_marche: string | null;
  nb_calcules: number;
  nb_ecrits: number;
  message: string | null;
}

export async function runRange52(opts: { mock?: boolean } = {}): Promise<Range52RunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    logger.warn('Mode MOCK range52 : aucun calcul, aucune écriture.');
    return { status: 'mock', date_marche: null, nb_calcules: 0, nb_ecrits: 0, message: null };
  }

  try {
    const sb = getSupabase();

    const { data: derniere, error: errDate } = await sb
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errDate) throw new Error(`dernière séance : ${errDate.message}`);

    const dateMarche = (derniere?.date_marche as string | undefined) ?? null;
    if (!dateMarche) {
      return {
        status: 'success',
        date_marche: null,
        nb_calcules: 0,
        nb_ecrits: 0,
        message: 'aucune séance en base',
      };
    }

    const depuis = new Date(Date.parse(`${dateMarche}T12:00:00Z`) - 365 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    /* PAGINATION OBLIGATOIRE. Environ 48 valeurs sur ~250 séances font plus de
       10 000 lignes, très au-delà du plafond de 1000 de PostgREST — qui
       tronque en SILENCE. Sans pagination, les bornes seraient calculées sur
       la seule première page : fausses, et parfaitement plausibles. C'est
       exactement le défaut qui a faussé mon propre audit des dividendes. */
    const TAILLE = 1000;
    const lignes: Cloture[] = [];
    for (let debut = 0; ; debut += TAILLE) {
      const { data, error } = await sb
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .gte('date_marche', depuis)
        .lte('date_marche', dateMarche)
        .order('date_marche', { ascending: true })
        .order('code', { ascending: true })
        .range(debut, debut + TAILLE - 1);
      if (error) throw new Error(`lecture historique : ${error.message}`);
      const lot = (data ?? []) as Cloture[];
      lignes.push(...lot);
      if (lot.length < TAILLE) break;
    }

    const bornes = calculerBornes(lignes);
    logger.info(
      { date_marche: dateMarche, depuis, lignes_lues: lignes.length, codes: bornes.size },
      'Bornes 52 semaines calculées',
    );

    if (cfg.DRY_RUN) {
      logger.warn('DRY_RUN : bornes calculées mais non écrites.');
      return {
        status: 'success',
        date_marche: dateMarche,
        nb_calcules: bornes.size,
        nb_ecrits: 0,
        message: 'DRY_RUN',
      };
    }

    /* Écriture sur la SEULE dernière séance : c'est `latestDaily` que le
       frontend lit partout. Remplir les 48 640 lignes historiques coûterait
       cher pour une donnée que personne ne consulte à une date passée. */
    let nbEcrits = 0;
    for (const [code, b] of bornes) {
      const { error } = await sb
        .from('brvm_actions_daily')
        .update({ cours_bas_52s: b.bas, cours_haut_52s: b.haut })
        .eq('code', code)
        .eq('date_marche', dateMarche);
      if (error) {
        logger.warn({ code, err: error.message }, 'Écriture bornes 52s échouée');
        continue;
      }
      nbEcrits++;
    }

    logger.info({ date_marche: dateMarche, nb_ecrits: nbEcrits }, 'Bornes 52 semaines écrites');
    return {
      status: 'success',
      date_marche: dateMarche,
      nb_calcules: bornes.size,
      nb_ecrits: nbEcrits,
      message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Calcul des bornes 52 semaines échoué');
    return { status: 'failed', date_marche: null, nb_calcules: 0, nb_ecrits: 0, message };
  }
}
