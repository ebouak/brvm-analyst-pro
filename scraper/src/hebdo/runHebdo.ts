/**
 * Édition hebdomadaire : sélectionne les valeurs notables de la semaine, fige
 * un snapshot de leurs métriques, génère le narratif, PUBLIE l'édition et
 * envoie une alerte (l'admin peut réviser/dépublier ensuite).
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { dispatch } from '../alerts/channels.js';
import { polishNarrative } from './polish.js';
import { resolveApiKeyForScraper } from './apiKey.js';
import { selectHebdo } from './pure/select.js';
import { buildSkeleton } from './pure/narrative.js';
import { computeLevels } from './pure/levels.js';
import { rsiSeries, macdSeries } from './pure/indicators.js';

export interface HebdoRunResult {
  status: 'success' | 'mock' | 'failed';
  date_edition: string | null;
  nb_items: number;
}

const PAGE = 1000;
const HISTO = 60;

export async function runHebdo(opts: { mock?: boolean } = {}): Promise<HebdoRunResult> {
  if (opts.mock) {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
    const picks = selectHebdo([
      { code: 'AAAA', closes, variationHebdo: 6, volume: 3000, avgVolume20: 1000 },
      { code: 'BBBB', closes, variationHebdo: 4, volume: 1500, avgVolume20: 1000 },
      { code: 'ZZZZ', closes: [...closes].reverse(), variationHebdo: -5, volume: 2200, avgVolume20: 1000 },
    ]);
    logger.info({ picks }, '[mock] hebdo');
    return { status: 'mock', date_edition: null, nb_items: picks.length };
  }

  const sb = getSupabase();

  // PostgREST plafonne chaque réponse à 1000 lignes : on pagine explicitement.
  const rows: { code: string; date_marche: string; cours_jour: number | null; volume: number | null }[] = [];
  for (let off = 0; off < 4000; off += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, volume')
      .order('date_marche', { ascending: false })
      .range(off, off + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  const dates = [...new Set(rows.map((r) => r.date_marche))].sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return { status: 'failed', date_edition: null, nb_items: 0 };
  const dateEdition = dates[0]!;
  const semaine = dates.slice(0, 5);

  const byCode = new Map<string, { date: string; close: number; volume: number | null }[]>();
  for (const r of rows) {
    if (r.cours_jour == null) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push({ date: r.date_marche, close: r.cours_jour, volume: r.volume });
  }
  for (const [, list] of byCode) list.sort((a, b) => a.date.localeCompare(b.date));

  const candidats = [...byCode.entries()].map(([code, list]) => {
    const serie = list.slice(-HISTO);
    const closes = serie.map((x) => x.close);
    const debutSemaine = serie.find((x) => x.date === semaine[semaine.length - 1])?.close ?? closes[0]!;
    const dernier = closes[closes.length - 1]!;
    const variationHebdo = debutSemaine > 0 ? ((dernier - debutSemaine) / debutSemaine) * 100 : null;
    const vols = serie.slice(-20).map((x) => x.volume ?? 0);
    const avgVolume20 = vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
    return { code, closes, variationHebdo, volume: serie[serie.length - 1]?.volume ?? null, avgVolume20 };
  });

  const picks = selectHebdo(candidats);
  if (picks.length === 0) {
    logger.warn('hebdo : aucune valeur retenue');
    return { status: 'failed', date_edition: dateEdition, nb_items: 0 };
  }

  const { data: ed, error: eEd } = await sb
    .from('hebdo_editions')
    .upsert({ date_edition: dateEdition, statut: 'publie', auto: true, published_at: new Date().toISOString() }, { onConflict: 'date_edition' })
    .select('id')
    .single();
  if (eEd) throw eEd;

  let ordre = 0;
  for (const p of picks) {
    const serie = (byCode.get(p.code) ?? []).slice(-HISTO);
    const closes = serie.map((x) => x.close);
    const c = candidats.find((x) => x.code === p.code)!;
    const macd = macdSeries(closes);
    const rsiSerie = rsiSeries(closes, 14);
    const hist = macd.at(-1)?.hist ?? null;
    const metrics = {
      code: p.code,
      dates: serie.map((x) => x.date),
      closes,
      rsi: rsiSerie,
      dernier: closes[closes.length - 1]!,
      variationHebdo: c.variationHebdo,
      volume: c.volume,
      ratioVolume: c.avgVolume20 && c.avgVolume20 > 0 && c.volume != null ? c.volume / c.avgVolume20 : null,
      rsiDernier: rsiSerie.at(-1) ?? null,
      macdPositif: hist == null ? null : hist > 0,
      levels: computeLevels(closes),
    };
    const sk = buildSkeleton(metrics);
    const sections = await polishNarrative(sk.sections, sk.chiffres, resolveApiKeyForScraper);
    const narratif = sections.map((s) => `## ${s.titre}\n\n${s.texte}`).join('\n\n');

    const { error: eIt } = await sb.from('hebdo_items').upsert(
      { edition_id: ed.id, code: p.code, sens: p.sens, raison: p.raison, metrics, narratif_md: narratif, ordre: ordre++ },
      { onConflict: 'edition_id,code' },
    );
    if (eIt) throw eIt;
  }

  const lien = `https://www.westbourse.com/analyses/hebdo/${dateEdition}`;
  await dispatch({
    subject: `Édition hebdo publiée — ${picks.length} valeurs`,
    body: `L'analyse hebdomadaire du ${dateEdition} est en ligne : ${lien}\nValeurs : ${picks.map((p) => p.code).join(', ')}\nRévisez ou dépubliez depuis /admin/hebdo si nécessaire.`,
    code: null,
    to: null,
  });

  logger.info({ date: dateEdition, items: picks.length }, 'hebdo publiée');
  return { status: 'success', date_edition: dateEdition, nb_items: picks.length };
}
