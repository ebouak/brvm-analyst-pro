/**
 * Édition hebdomadaire : sélectionne les valeurs notables de la semaine, fige
 * un snapshot de leurs métriques, génère le narratif, PUBLIE l'édition et
 * envoie une alerte (l'admin peut réviser/dépublier ensuite).
 *
 * La préparation (`preparerEdition`) ne fait que LIRE : elle sert aussi à
 * rejouer une semaine passée en aperçu, sans écrire en base ni rien envoyer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { dispatch } from '../alerts/channels.js';
import { polishNarrative } from './polish.js';
import { resolveApiKeyForScraper } from './apiKey.js';
import { selectHebdo, scoreCandidat } from './pure/select.js';
import { buildSkeleton, type Skeleton } from './pure/narrative.js';
import { buildPost } from './pure/post.js';
import { computeLevels, pasDeCotation, MARGE_SORTIE_PCT } from './pure/levels.js';
import { rsiSeries, macdSeries } from './pure/indicators.js';
import {
  construireAnalyse, variationHebdomadaire, lundiDe, INDICE_MARCHE, INDICE_SECTEUR,
  type IncomeAnnuel, type DividendeLigne, type PointSerie,
} from './pure/analyse.js';
import type { HebdoCandidate, HebdoMetrics, HebdoPick } from './pure/types.js';

export interface HebdoRunResult {
  status: 'success' | 'mock' | 'failed';
  date_edition: string | null;
  nb_items: number;
}

const PAGE = 1000;
const HISTO = 60;
const MAX_LIGNES = 5000;

export interface ItemPrepare {
  pick: HebdoPick;
  metrics: HebdoMetrics;
  squelette: Skeleton;
}

export interface EditionPreparee {
  dateEdition: string;
  /** Sélection du moteur pour la semaine. */
  selection: HebdoPick[];
  items: ItemPrepare[];
}

type Ligne = {
  code: string; date_marche: string; cours_jour: number | null; volume: number | null;
  valeur_echangee: number | null; cours_haut_52s: number | null; cours_bas_52s: number | null;
};

const num = (x: unknown): number | null => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);

function parCode<T>(rows: T[], cle: keyof T): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[cle]);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * LECTURE seule. `date` fige l'édition sur une séance passée (aperçu) ;
 * `codes` force les valeurs à rédiger (par défaut : la sélection du moteur).
 */
export async function preparerEdition(
  sb: SupabaseClient,
  opts: { date?: string; codes?: string[] } = {},
): Promise<EditionPreparee | null> {
  // PostgREST plafonne chaque réponse à 1000 lignes : on pagine explicitement.
  const rows: Ligne[] = [];
  for (let off = 0; off < MAX_LIGNES; off += PAGE) {
    let q = sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, volume, valeur_echangee, cours_haut_52s, cours_bas_52s')
      .order('date_marche', { ascending: false })
      .order('code', { ascending: true })
      .range(off, off + PAGE - 1);
    if (opts.date) q = q.lte('date_marche', opts.date);
    const { data, error } = await q;
    if (error) throw error;
    const page = (data ?? []) as Ligne[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  const dates = [...new Set(rows.map((r) => r.date_marche))].sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return null;
  const dateEdition = dates[0]!;
  const lundi = lundiDe(dateEdition);
  const anneeSeance = Number(dateEdition.slice(0, 4));

  const byCode = new Map<string, (PointSerie & { haut52: number | null; bas52: number | null })[]>();
  for (const r of rows) {
    const close = num(r.cours_jour);
    if (close == null || close <= 0) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push({
      date: r.date_marche, close, volume: num(r.volume), valeur: num(r.valeur_echangee),
      haut52: num(r.cours_haut_52s), bas52: num(r.cours_bas_52s),
    });
  }
  for (const [, list] of byCode) list.sort((a, b) => a.date.localeCompare(b.date));

  const candidats: HebdoCandidate[] = [...byCode.entries()].map(([code, list]) => {
    const serie = list.slice(-HISTO);
    const vols = serie.slice(-20).map((x) => x.volume ?? 0);
    const avgVolume20 = vols.length > 0 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
    return {
      code,
      closes: serie.map((x) => x.close),
      // Référence : clôture de la séance qui PRÉCÈDE la semaine (le lundi compte).
      variationHebdo: variationHebdomadaire(list, dateEdition).variation,
      volume: serie[serie.length - 1]?.volume ?? null,
      avgVolume20,
    };
  });

  const selection = selectHebdo(candidats);
  const picks: HebdoPick[] = opts.codes
    ? opts.codes
        .map((c) => candidats.find((x) => x.code === c))
        .filter((c): c is HebdoCandidate => !!c)
        .map((c) => scoreCandidat(c))
        .filter((p): p is HebdoPick => !!p)
    : selection;
  if (picks.length === 0) return { dateEdition, selection, items: [] };
  const codes = picks.map((p) => p.code);

  // Valeur échangée sur toute la cote pendant la semaine.
  const semaineRows = rows.filter((r) => r.date_marche >= lundi && r.date_marche <= dateEdition);
  const valeurMarcheSemaine = semaineRows.some((r) => num(r.valeur_echangee) != null)
    ? semaineRows.reduce((a, r) => a + (num(r.valeur_echangee) ?? 0), 0) : null;

  const lire = async <T>(nom: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> => {
    const { data, error } = await q;
    if (error) throw new Error(`hebdo : lecture ${nom} impossible — ${error.message}`);
    return (data ?? []) as T[];
  };

  const instruments = await lire<{ code: string; secteur: string | null; shares: number | null }>(
    'brvm_instruments', sb.from('brvm_instruments').select('code, secteur, shares').eq('type', 'action'),
  );
  const instrument = new Map(instruments.map((i) => [i.code, i]));
  const income = await lire<IncomeAnnuel & { code: string }>(
    'income_statements',
    sb.from('income_statements')
      .select('code, periode, resultat_net, resultat_exploitation, resultat_avant_impots, benefice_par_action')
      .eq('type_periode', 'annuel')
      .gte('periode', String(anneeSeance - 4)),
  );
  const dividendes = await lire<DividendeLigne & { code: string }>(
    'dividends',
    sb.from('dividends').select('code, exercice, montant, base_fiscale, ex_date, payment_date').gte('exercice', anneeSeance - 4),
  );
  const indicesCodes = [INDICE_MARCHE, ...new Set(Object.values(INDICE_SECTEUR))];
  const indices = await lire<{ code: string; date_marche: string; valeur: number | null }>(
    'brvm_indices_daily',
    sb.from('brvm_indices_daily').select('code, date_marche, valeur').in('code', indicesCodes)
      .gte('date_marche', ajouterJours(lundi, -21)).lte('date_marche', dateEdition),
  );
  const liquidites = await lire<{ code: string; date_marche: string; classe: string | null; valeur_moyenne_30j: number | null }>(
    'liquidity_daily',
    sb.from('liquidity_daily').select('code, date_marche, classe, valeur_moyenne_30j').in('code', codes)
      .gte('date_marche', ajouterJours(dateEdition, -10)).lte('date_marche', dateEdition)
      .order('date_marche', { ascending: false }),
  );
  const carnets = await lire<{
    code: string; date_marche: string; cours_achat: number | null; cours_vente: number | null;
    achat_au_marche: boolean | null; vente_au_marche: boolean | null;
  }>(
    'brvm_carnet_daily',
    sb.from('brvm_carnet_daily').select('code, date_marche, cours_achat, cours_vente, achat_au_marche, vente_au_marche')
      .in('code', codes).gte('date_marche', lundi).lte('date_marche', dateEdition)
      .order('date_marche', { ascending: false }),
  );
  const publications = await lire<{ code: string; date_publication: string; libelle: string }>(
    'publications',
    sb.from('publications').select('code, date_publication, libelle').in('code', codes)
      .gte('date_publication', lundi).lte('date_publication', dateEdition),
  );
  const actualites = await lire<{ instrument_code: string; event_date: string; title: string }>(
    'market_events',
    sb.from('market_events').select('instrument_code, event_date, title').in('instrument_code', codes)
      .gte('event_date', lundi).lte('event_date', dateEdition),
  );
  const operations = await lire<{ code: string; date_effet: string; type: string }>(
    'operations_titres', sb.from('operations_titres').select('code, date_effet, type').in('code', codes),
  );
  const finAnnee = `${anneeSeance - 1}-12-31`;
  const clotures = await lire<{ code: string; date_marche: string; cours_jour: number | null }>(
    'brvm_actions_daily (fin d’année)',
    sb.from('brvm_actions_daily').select('code, date_marche, cours_jour').in('code', codes)
      .gte('date_marche', `${anneeSeance - 1}-12-01`).lte('date_marche', finAnnee)
      .order('date_marche', { ascending: false }),
  );

  const incomeBy = parCode(income, 'code');
  const divBy = parCode(dividendes, 'code');
  const idxBy = parCode(indices, 'code');
  const indicesPts: Record<string, { points: { date: string; valeur: number }[] }> = {};
  for (const [c, l] of idxBy) {
    indicesPts[c] = { points: l.map((x) => ({ date: x.date_marche, valeur: num(x.valeur) ?? 0 })).filter((x) => x.valeur > 0) };
  }
  const coursDuJour = (c: string) => {
    const l = byCode.get(c);
    const d = l?.at(-1);
    return d && d.date === dateEdition ? d.close : null;
  };

  const items: ItemPrepare[] = [];
  for (const p of picks) {
    const listeComplete = byCode.get(p.code) ?? [];
    const serie = listeComplete.slice(-HISTO);
    const closes = serie.map((x) => x.close);
    const c = candidats.find((x) => x.code === p.code)!;
    const macd = macdSeries(closes);
    const rsiSerie = rsiSeries(closes, 14);
    const hist = macd.at(-1)?.hist ?? null;
    const secteur = instrument.get(p.code)?.secteur ?? null;
    const derniere = serie.at(-1);
    const fin = clotures.find((x) => x.code === p.code && num(x.cours_jour) != null && num(x.cours_jour)! > 0);
    const liq = liquidites.find((x) => x.code === p.code) ?? null;
    const carnet = carnets.find((x) => x.code === p.code) ?? null;

    const analyse = construireAnalyse({
      dateEdition,
      serie: listeComplete,
      clotureFinAnnee: fin ? { date: fin.date_marche, close: num(fin.cours_jour)! } : null,
      operations: operations.filter((o) => o.code === p.code),
      bornes52: { haut: derniere?.haut52 ?? null, bas: derniere?.bas52 ?? null },
      indices: indicesPts,
      secteur,
      valeurMarcheSemaine,
      liquidite: liq ? { classe: liq.classe, valeur_moyenne_30j: num(liq.valeur_moyenne_30j) } : null,
      carnet: carnet
        ? { ...carnet, cours_achat: num(carnet.cours_achat), cours_vente: num(carnet.cours_vente) }
        : null,
      titres: num(instrument.get(p.code)?.shares),
      income: incomeBy.get(p.code) ?? [],
      dividendes: divBy.get(p.code) ?? [],
      pairs: secteur
        ? instruments
            .filter((i) => i.secteur === secteur && i.code !== p.code)
            .map((i) => ({
              code: i.code,
              cours: coursDuJour(i.code),
              titres: num(i.shares),
              income: incomeBy.get(i.code) ?? [],
              dividendes: divBy.get(i.code) ?? [],
            }))
        : [],
      publications: publications.filter((x) => x.code === p.code),
      actualites: actualites.filter((x) => x.instrument_code === p.code),
    });

    const metrics: HebdoMetrics = {
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
      levels: computeLevels(closes, { pas: pasDeCotation(closes), margePct: MARGE_SORTIE_PCT }),
      analyse,
    };
    items.push({ pick: p, metrics, squelette: buildSkeleton(metrics) });
  }
  return { dateEdition, selection, items };
}

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
  const edition = await preparerEdition(sb);
  if (!edition) return { status: 'failed', date_edition: null, nb_items: 0 };
  const { dateEdition, items } = edition;
  if (items.length === 0) {
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
  for (const { pick: p, metrics, squelette: sk } of items) {
    const sections = await polishNarrative(sk.sections, sk.chiffres, resolveApiKeyForScraper);
    const narratif = sections.map((s) => `## ${s.titre}\n\n${s.texte}`).join('\n\n');
    // Les posts sont composés depuis les sections VALIDÉES : mêmes garanties.
    const skValide = { ...sk, sections };
    const postLong = buildPost(skValide, metrics, 'long');
    const postCourt = buildPost(skValide, metrics, 'court');

    const { error: eIt } = await sb.from('hebdo_items').upsert(
      {
        edition_id: ed.id, code: p.code, sens: p.sens, raison: p.raison, metrics,
        narratif_md: narratif, post_long: postLong, post_court: postCourt, ordre: ordre++,
      },
      { onConflict: 'edition_id,code' },
    );
    if (eIt) throw eIt;
  }

  const lien = `https://www.westbourse.com/analyses/hebdo/${dateEdition}`;
  // Journaliser l'issue de chaque canal : un échec d'envoi (Resend 4xx…) ne doit
  // pas passer inaperçu sous prétexte que la publication, elle, a réussi.
  const envois = await dispatch({
    subject: `Édition hebdo publiée — ${items.length} valeurs`,
    body: `L'analyse hebdomadaire du ${dateEdition} est en ligne : ${lien}\nValeurs : ${items.map((i) => i.pick.code).join(', ')}\nRévisez ou dépubliez depuis /admin/hebdo si nécessaire.`,
    code: null,
    to: null,
    // Message d'exploitation : autorise le repli vers ALERTS_EMAIL_TO.
    operateur: true,
  });
  for (const e of envois) {
    if (e.status === 'sent') logger.info({ canal: e.channel }, 'hebdo : notification envoyée');
    else logger.error({ canal: e.channel, err: e.error }, 'hebdo : notification échouée');
  }

  logger.info({ date: dateEdition, items: items.length }, 'hebdo publiée');
  return { status: 'success', date_edition: dateEdition, nb_items: items.length };
}
