/**
 * Calcul quotidien de l'indice de nervosité BRVM-V : relit toutes les clôtures
 * depuis DEBUT_SERIE, recalcule la série complète et l'upsert dans
 * `brvm_nervosite_daily` (clé `date_marche` — idempotent : relancer réécrit les
 * mêmes valeurs).
 *
 * La série est recalculée en entier à chaque passage plutôt que prolongée
 * d'une ligne : une cotation corrigée en base (reprise d'une séance, opération
 * sur titres requalifiée) se propage ainsi d'elle-même, sans état caché.
 *
 * --mock : série synthétique en mémoire, aucun accès réseau ni écriture.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { construireSerie, DEBUT_SERIE, type CoursLigne, type LigneNervosite } from './construire.js';

export const TABLE_NERVOSITE = 'brvm_nervosite_daily';
const PAGE = 1000;

export interface NervositeRunResult {
  status: 'success' | 'mock' | 'failed';
  date_marche: string | null;
  valeur: number | null;
  regime: string | null;
  nb_seances: number;
  nb_ecrites: number;
  raison?: string;
}

/** Fixture déterministe : 6 titres, 400 séances, volatilité qui double à la fin. */
export function lignesMock(): CoursLigne[] {
  const out: CoursLigne[] = [];
  let graine = 12345;
  const alea = () => ((graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0) / 4294967296) - 0.5;
  const codes = ['AAAC', 'BBBC', 'CCCC', 'DDDC', 'EEEC', 'FFFC'];
  const cours = codes.map(() => 1000);
  const debut = Date.UTC(2025, 0, 1);
  for (let j = 0; j < 400; j++) {
    const d = new Date(debut + j * 86_400_000).toISOString().slice(0, 10);
    const amplitude = j < 340 ? 0.02 : 0.05;
    codes.forEach((code, k) => {
      cours[k] = Math.max(1, Math.round(cours[k]! * (1 + alea() * amplitude)));
      out.push({ code, date_marche: d, cours_jour: cours[k]! });
    });
  }
  return out;
}

/**
 * Lit les clôtures paginées. PostgREST plafonne CHAQUE réponse à 1000 lignes
 * EN SILENCE : sans pagination, la série s'arrêterait à quelques semaines sans
 * aucun message. Le tri sur la clé (date, code) rend les pages disjointes.
 */
export async function lireCours(sb: SupabaseClient, debut = DEBUT_SERIE): Promise<CoursLigne[]> {
  const out: CoursLigne[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour')
      .gte('date_marche', debut)
      .order('date_marche', { ascending: true })
      .order('code', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`lecture brvm_actions_daily : ${error.message}`);
    const rows = (data ?? []) as CoursLigne[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Upsert par lots sur la clé `date_marche`. Lève à la première erreur. */
export async function ecrireNervosite(
  sb: Pick<SupabaseClient, 'from'>,
  lignes: readonly LigneNervosite[],
  { taille = 500, maintenant = new Date().toISOString() }: { taille?: number; maintenant?: string } = {},
): Promise<number> {
  let n = 0;
  for (let i = 0; i < lignes.length; i += taille) {
    const lot = lignes.slice(i, i + taille).map((l) => ({ ...l, updated_at: maintenant }));
    const { error } = await sb.from(TABLE_NERVOSITE).upsert(lot, { onConflict: 'date_marche' });
    if (error) throw new Error(`upsert ${TABLE_NERVOSITE} : ${error.message}`);
    n += lot.length;
  }
  return n;
}

export async function runNervosite(opts: { mock?: boolean; dryRun?: boolean } = {}): Promise<NervositeRunResult> {
  const lignes = opts.mock ? lignesMock() : await lireCours(getSupabase());
  const serie = construireSerie(lignes, opts.mock ? '2025-01-01' : DEBUT_SERIE);
  const derniere = serie.at(-1) ?? null;
  const base = {
    date_marche: derniere?.date_marche ?? null,
    valeur: derniere?.valeur ?? null,
    regime: derniere?.regime ?? null,
    nb_seances: serie.length,
  };

  if (!derniere || derniere.valeur === null) {
    // Échec BRUYANT : une table vide ou un historique trop court ne doit pas
    // passer pour un run réussi.
    const raison = !derniere ? 'aucune séance exploitable' : `historique insuffisant (${serie.length} séances)`;
    logger.error({ ...base, raison }, 'nervosité : rien à publier');
    return { status: 'failed', ...base, nb_ecrites: 0, raison };
  }

  if (opts.mock) {
    logger.info(base, '[mock] nervosité calculée, aucune écriture');
    return { status: 'mock', ...base, nb_ecrites: 0 };
  }

  const dryRun = opts.dryRun ?? getConfig().DRY_RUN;
  if (dryRun) {
    logger.info({ ...base, nb: serie.length }, `[DRY_RUN] upsert ${TABLE_NERVOSITE} sauté`);
    return { status: 'success', ...base, nb_ecrites: 0 };
  }

  const nb = await ecrireNervosite(getSupabase(), serie);
  logger.info({ ...base, nb_ecrites: nb }, 'nervosité BRVM-V calculée');
  return { status: 'success', ...base, nb_ecrites: nb };
}
