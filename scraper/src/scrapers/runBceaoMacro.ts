import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { parseBceaoRates } from '../parsers/bceao.js';

const URL = 'https://www.bceao.int/';

function fixture(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, '..', '..', 'tests', 'fixtures', 'bceao-home.html'), 'utf8');
}

async function getHtml(mock: boolean): Promise<string> {
  if (mock) return fixture();
  const resp = await fetch(URL, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WestbourseBot/1.0; +https://www.westbourse.com)' },
  });
  if (!resp.ok) throw new Error(`BCEAO HTTP ${resp.status}`);
  return resp.text();
}

/**
 * Vérifie les taux directeurs BCEAO (bceao.int) et met à jour
 * macro_indicators UNIQUEMENT si la valeur a réellement changé — préserve
 * sinon la date d'effet (as_of) déjà en base plutôt que de la réécrire à
 * chaque exécution. Décisions de politique monétaire rares (quelques fois
 * par an) : cron mensuel suffit largement, jamais de donnée inventée si le
 * parsing échoue (skip silencieux, alerté via les logs/monitoring).
 */
export async function runBceaoMacro(opts: { mock?: boolean } = {}): Promise<{ status: 'success' | 'unchanged' | 'failed'; updated: string[] }> {
  const mock = opts.mock ?? false;

  let html: string;
  try {
    html = await getHtml(mock);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'bceao-macro : fetch échoué');
    return { status: 'failed', updated: [] };
  }

  const rates = parseBceaoRates(html);
  if (rates.tauxDirecteur == null && rates.guichetMarginal == null) {
    logger.warn('bceao-macro : aucun taux trouvé — page probablement changée, aucune écriture');
    return { status: 'failed', updated: [] };
  }

  if (mock) {
    logger.info({ rates }, 'bceao-macro --mock : aucune écriture');
    return { status: 'success', updated: [] };
  }

  const sb = getSupabase();
  const { data: existing } = await sb
    .from('macro_indicators')
    .select('key, value, as_of')
    .in('key', ['bceao_taux_directeur', 'bceao_guichet_marginal']);
  const byKey = new Map((existing ?? []).map((r) => [r.key as string, r as { key: string; value: number; as_of: string }]));

  const updated: string[] = [];
  const asOf = rates.effectifDepuis;

  const candidates: { key: string; label: string; value: number | null }[] = [
    { key: 'bceao_taux_directeur', label: 'Taux directeur BCEAO', value: rates.tauxDirecteur },
    { key: 'bceao_guichet_marginal', label: 'Guichet de prêt marginal BCEAO', value: rates.guichetMarginal },
  ];

  for (const c of candidates) {
    if (c.value == null) continue;
    const prev = byKey.get(c.key);
    // Valeur inchangée → on ne touche à rien (préserve l'as_of déjà correct).
    if (prev && Math.abs(prev.value - c.value) < 0.001) continue;

    const { error } = await sb.from('macro_indicators').upsert(
      {
        key: c.key,
        label: c.label,
        value: c.value,
        unit: '%',
        as_of: asOf ?? new Date().toISOString().slice(0, 10),
        source_url: URL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    if (error) {
      logger.error({ key: c.key, err: error.message }, 'bceao-macro : upsert échoué');
      continue;
    }
    updated.push(c.key);
    logger.info({ key: c.key, ancienne: prev?.value ?? null, nouvelle: c.value, asOf }, 'bceao-macro : taux mis à jour');
  }

  logger.info({ updated, rates }, 'bceao-macro terminé');
  return { status: updated.length > 0 ? 'success' : 'unchanged', updated };
}
