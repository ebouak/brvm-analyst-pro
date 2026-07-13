import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { parseWorldBankInflation, UEMOA, type InflationPoint } from '../parsers/worldBankInflation.js';

/**
 * Inflation annuelle (IPC) des 8 pays de l'UEMOA — API Banque mondiale.
 *
 * Indicateur FP.CPI.TOTL.ZG (« Inflation, consumer prices, annual % »). API
 * publique, gratuite, sans clé. Chiffre recoupé avec celui de la BCEAO pour
 * l'UEMOA (~0 % en 2025) : concordant.
 *
 * Sert au calcul du RENDEMENT RÉEL : sans inflation, on ne peut pas dire à un
 * investisseur si son +3 % est un gain ou une perte de pouvoir d'achat.
 *
 * Idempotent : upsert sur (pays_code, annee). Rejouable sans créer de doublon.
 * L'API révise les chiffres a posteriori — on écrase donc la valeur, ce qui est
 * voulu (la révision est une correction, pas une perte).
 */

const API = 'https://api.worldbank.org/v2/country';
const INDICATOR = 'FP.CPI.TOTL.ZG';
const SOURCE_URL = 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG';
const DEPUIS = 2015; // profondeur suffisante pour un rendement réel long terme

/** Chiffres de secours en mode --mock (issus d'un appel réel, non inventés). */
const MOCK: Record<string, number> = {
  BEN: 1.16, BFA: 4.19, CIV: 3.45, GNB: 3.77,
  MLI: 3.21, NER: 9.07, SEN: 0.8, TGO: 2.86,
};

async function fetchPays(code: string, mock: boolean): Promise<InflationPoint[]> {
  if (mock) {
    const taux = MOCK[code];
    return taux === undefined ? [] : [{ paysCode: code, annee: 2024, tauxPct: taux }];
  }

  const url = `${API}/${code}/indicator/${INDICATOR}?format=json&per_page=100&date=${DEPUIS}:${new Date().getFullYear()}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'WestbourseBot/1.0 (+https://www.westbourse.com)' },
  });
  if (!resp.ok) throw new Error(`World Bank HTTP ${resp.status} (${code})`);
  return parseWorldBankInflation(await resp.json());
}

export interface InflationResult {
  rows: number;
  pays: number;
}

export async function runInflation(
  opts: { mock?: boolean; dryRun?: boolean } = {},
): Promise<InflationResult> {
  const mock = opts.mock ?? false;
  const rows: Record<string, unknown>[] = [];
  const paysOk = new Set<string>();

  for (const { code, nom } of UEMOA) {
    try {
      const points = await fetchPays(code, mock);
      if (points.length === 0) {
        // On journalise le trou plutôt que de le combler : un pays sans donnée
        // doit apparaître comme « indisponible », pas comme « inflation nulle ».
        logger.warn({ pays: code }, 'inflation: aucune donnée renvoyée');
        continue;
      }
      for (const p of points) {
        rows.push({
          pays_code: p.paysCode,
          pays_nom: nom,
          annee: p.annee,
          taux_pct: p.tauxPct,
          source: 'World Bank (FP.CPI.TOTL.ZG)',
          source_url: SOURCE_URL,
          updated_at: new Date().toISOString(),
        });
      }
      paysOk.add(code);
      logger.info({ pays: code, points: points.length }, 'inflation: collectée');
    } catch (e) {
      // Un pays en échec ne doit pas faire tomber les sept autres.
      logger.error({ pays: code, err: (e as Error).message }, 'inflation: échec');
    }
  }

  if (rows.length === 0) throw new Error('inflation: aucune donnée collectée');

  if (opts.dryRun) {
    logger.info({ lignes: rows.length }, 'inflation: DRY_RUN, rien écrit');
    return { rows: rows.length, pays: paysOk.size };
  }

  const { error } = await getSupabase()
    .from('macro_inflation')
    .upsert(rows, { onConflict: 'pays_code,annee' });
  if (error) throw new Error(`inflation: upsert échoué — ${error.message}`);

  logger.info({ lignes: rows.length, pays: paysOk.size }, 'inflation: écrite en base');
  return { rows: rows.length, pays: paysOk.size };
}
