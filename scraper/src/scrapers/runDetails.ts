/**
 * Ingestion des détails richbourse.
 *
 * Deux écritures de nature différente, et une seule est conditionnée :
 *
 *   - `brvm_instruments.flottant` / `vol_moyen_30j` — données de société,
 *     indépendantes de la séance : écrites systématiquement. Elles étaient à
 *     0 ligne sur 335 depuis la migration `0020`, parce que ce scraper prenait
 *     403 sur chaque appel (mauvais agent HTTP) et n'était planifié nulle part.
 *
 *   - `brvm_actions_daily.ouverture / plus_haut / plus_bas` — données de
 *     séance : écrites SEULEMENT si la clôture affichée par richbourse égale
 *     notre `cours_jour`. Sans cette preuve, on collerait les extrêmes d'une
 *     séance sous la clôture d'une autre — au 2026-09-08, cela concernait
 *     38 valeurs sur 47. La fiche action et le StockSpotlight de la landing
 *     affichent ces bornes : un chiffre faux y serait directement visible.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { scrapeDetails } from './richbourse-details.js';

/** Une requête toutes les 800 ms : 47 valeurs, une fois par jour. */
const THROTTLE_MS = 800;
/** Tolérance de comparaison des clôtures, en FCFA. */
const EPS = 0.51;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface DetailsResult {
  status: 'success' | 'failed' | 'mock';
  /** Valeurs pour lesquelles la page a répondu. */
  count: number;
  /** Sociétés dont flottant/volume moyen ont été écrits. */
  nb_societe: number;
  /** Séances écrites (clôture concordante). */
  nb_seance: number;
  /** Valeurs écartées pour cause de séance discordante. */
  nb_discordantes: number;
  date_marche: string | null;
  message?: string;
}

const VIDE: DetailsResult = {
  status: 'success',
  count: 0,
  nb_societe: 0,
  nb_seance: 0,
  nb_discordantes: 0,
  date_marche: null,
};

export async function runDetails(
  opts: { codes?: string[]; mock?: boolean } = {},
): Promise<DetailsResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    logger.info('Details mock — pas de scraping richbourse');
    return { ...VIDE, status: 'mock', message: 'mode mock, aucun upsert' };
  }

  try {
    const sb = getSupabase();

    /* Ancre de séance : notre base, jamais la date du jour. La page richbourse
       ne porte aucune date exploitable, et se rabattre sur « aujourd'hui »
       écrivait dans une ligne inexistante le week-end — un no-op silencieux
       que le journal rapportait comme un succès. */
    const { data: derniere } = await sb
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    const dateMarche = (derniere?.date_marche as string | undefined) ?? null;
    if (!dateMarche) return { ...VIDE, message: 'aucune séance en base' };

    const { data: seance } = await sb
      .from('brvm_actions_daily')
      .select('code, cours_jour')
      .eq('date_marche', dateMarche);
    const cloturesBase = new Map<string, number | null>(
      (seance ?? []).map((r) => [r.code as string, r.cours_jour == null ? null : Number(r.cours_jour)]),
    );

    let codes = opts.codes ?? [];
    if (codes.length === 0) {
      const { data } = await sb.from('brvm_instruments').select('code').eq('type', 'action');
      codes = (data ?? []).map((r: { code: string }) => r.code);
    }

    logger.info({ total: codes.length, date_marche: dateMarche }, 'Scraping détails richbourse');
    const res: DetailsResult = { ...VIDE, date_marche: dateMarche };
    const discordantes: string[] = [];

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;
      const d = await scrapeDetails(code);
      if (!d) {
        if (i < codes.length - 1) await sleep(THROTTLE_MS);
        continue;
      }
      res.count++;

      if (!cfg.DRY_RUN && (d.flottant != null || d.vol_moyen != null)) {
        const patch: Record<string, number> = {};
        if (d.flottant != null) patch.flottant = d.flottant;
        if (d.vol_moyen != null) patch.vol_moyen_30j = Math.round(d.vol_moyen);
        const { error } = await sb.from('brvm_instruments').update(patch).eq('code', code);
        if (error) logger.warn({ code, err: error.message }, 'Update brvm_instruments échoué');
        else res.nb_societe++;
      } else if (cfg.DRY_RUN && (d.flottant != null || d.vol_moyen != null)) {
        res.nb_societe++;
      }

      // PREUVE DE SÉANCE — la clôture de richbourse doit être la nôtre.
      const base = cloturesBase.get(code);
      const concordante =
        d.cloture_jour != null && base != null && Math.abs(d.cloture_jour - base) < EPS;

      if (!concordante) {
        res.nb_discordantes++;
        discordantes.push(`${code} rb=${d.cloture_jour} base=${base}`);
      } else if (d.ouverture != null || d.plus_haut != null || d.plus_bas != null) {
        if (cfg.DRY_RUN) res.nb_seance++;
        else {
          const { error } = await sb
            .from('brvm_actions_daily')
            .update({ ouverture: d.ouverture, plus_haut: d.plus_haut, plus_bas: d.plus_bas })
            .eq('code', code)
            .eq('date_marche', dateMarche);
          if (error) logger.warn({ code, err: error.message }, 'Update brvm_actions_daily échoué');
          else res.nb_seance++;
        }
      }

      if (i < codes.length - 1) await sleep(THROTTLE_MS);
    }

    if (discordantes.length > 0) {
      logger.warn(
        { nb: discordantes.length, exemples: discordantes.slice(0, 5) },
        'Séances discordantes — ouverture/plus haut/plus bas NON écrits pour ces valeurs',
      );
    }
    logger.info(
      { ...res, dry_run: cfg.DRY_RUN },
      'Détails richbourse ingérés',
    );
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Ingestion détails richbourse échouée');
    return { ...VIDE, status: 'failed', message };
  }
}
