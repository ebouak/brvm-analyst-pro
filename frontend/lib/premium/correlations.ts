import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { returns, pearson, beta, rollingCorr } from './correlationMath';
import { readCommodityMacro, type CommodityMacro } from './agroMacro';

/**
 * Filières agro BRVM ↔ matière première sous-jacente (commodity_prices).
 * Les codes sont les producteurs cotés ; la corrélation est calculée sur les
 * VARIATIONS mensuelles communes (vraies données — plus aucune série fabriquée).
 */
const FILIERES: Record<string, { commodity: string; codes: string[]; label: string; commodityLabel: string; couleur: string }> = {
  huile_palme: { commodity: 'palm_oil', codes: ['PALC', 'SOGC'], label: 'Huile de palme (PALMCI / SOGB)', commodityLabel: 'Huile de palme', couleur: '#f59e0b' },
  caoutchouc:  { commodity: 'rubber',   codes: ['SAPH', 'SOGB'], label: 'Caoutchouc (SAPH / SOGB)', commodityLabel: 'Caoutchouc', couleur: '#22c55e' },
  sucre:       { commodity: 'sugar',    codes: ['STAC', 'SUCR'], label: 'Sucre (SUCRIVOIRE)', commodityLabel: 'Sucre', couleur: '#e879f9' },
  cacao:       { commodity: 'cocoa',    codes: ['CFAC'],         label: 'Cacao / Agro', commodityLabel: 'Cacao', couleur: '#a16207' },
};

export interface CorrelationPoint {
  date: string;      // YYYY-MM
  cours: number;     // action, base 100
  commodity: number; // matière première réelle, base 100
}

export interface CorrelationSerie {
  matiere: string;
  label: string;
  commodityLabel: string;
  couleur: string;
  coefficient: number;            // Pearson sur variations mensuelles
  beta: number | null;
  nMonths: number;
  dataAvailable: boolean;
  points: CorrelationPoint[];
  rolling: { date: string; corr: number }[];
  macro: CommodityMacro;
  codes: string[];
  commodityUnit: string | null;
}

function monthKey(d: string): string {
  return d.slice(0, 7); // YYYY-MM
}

function normalise(levels: number[]): number[] {
  const first = levels.find((v) => v > 0);
  if (!first) return levels.map(() => 100);
  return levels.map((v) => (v > 0 ? (v / first) * 100 : 100));
}

export async function getCorrelationsData(): Promise<CorrelationSerie[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - 5 * 365 * 86400 * 1000).toISOString().slice(0, 10);

  const result: CorrelationSerie[] = [];

  for (const [matiere, meta] of Object.entries(FILIERES)) {
    // 1) Prix mensuels réels de la matière première.
    const { data: commo } = await supabase
      .from('commodity_prices')
      .select('date, price, unit')
      .eq('commodity', meta.commodity)
      .gte('date', since)
      .order('date', { ascending: true });

    const commoRows = (commo ?? []) as { date: string; price: number; unit: string | null }[];
    const commodityUnit = commoRows[0]?.unit ?? null;
    const commoByMonth = new Map<string, number>();
    for (const r of commoRows) commoByMonth.set(monthKey(r.date), r.price);

    // 2) Cours des actions agro → moyenne mensuelle.
    // Paginé : 5 ans × plusieurs titres dépasse largement 1000 lignes ; la
    // matrice de corrélation portait sinon sur la fraction la plus ancienne.
    const acts = await fetchAllRows<{ code: string; cours_jour: number; date_marche: string }>(
      (from, to) => supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour, date_marche')
        .in('code', meta.codes)
        .gte('date_marche', since)
        .not('cours_jour', 'is', null)
        .order('date_marche', { ascending: true })
        .range(from, to),
    );

    const stockMonth = new Map<string, number[]>();
    for (const r of (acts ?? []) as { cours_jour: number; date_marche: string }[]) {
      const k = monthKey(r.date_marche);
      if (!stockMonth.has(k)) stockMonth.set(k, []);
      stockMonth.get(k)!.push(r.cours_jour);
    }
    const stockByMonth = new Map<string, number>();
    for (const [k, vals] of stockMonth) stockByMonth.set(k, vals.reduce((s, v) => s + v, 0) / vals.length);

    // 3) Mois communs (intersection), triés.
    const commonMonths = [...stockByMonth.keys()].filter((k) => commoByMonth.has(k)).sort();

    const macro = readCommodityMacro(
      commoRows.map((r) => r.price),
      meta.commodityLabel,
      null,
    );

    if (commonMonths.length < 6) {
      // Données insuffisantes : état honnête, aucune corrélation fabriquée.
      result.push({
        matiere, label: meta.label, commodityLabel: meta.commodityLabel, couleur: meta.couleur,
        coefficient: 0, beta: null, nMonths: commonMonths.length, dataAvailable: false,
        points: [], rolling: [], macro, codes: meta.codes, commodityUnit,
      });
      continue;
    }

    const stockLevels = commonMonths.map((k) => stockByMonth.get(k)!);
    const commoLevels = commonMonths.map((k) => commoByMonth.get(k)!);

    const stockRet = returns(stockLevels);
    const commoRet = returns(commoLevels);
    const coefficient = pearson(commoRet, stockRet) ?? 0;
    const betaVal = beta(commoRet, stockRet);
    const roll = rollingCorr(commoRet, stockRet, 12);

    const stockBase = normalise(stockLevels);
    const commoBase = normalise(commoLevels);
    const points: CorrelationPoint[] = commonMonths.map((date, i) => ({
      date, cours: stockBase[i] ?? 100, commodity: commoBase[i] ?? 100,
    }));

    // rolling aligné sur les mois (décalé d'1 car sur les rendements).
    const rolling = roll
      .map((corr, i) => ({ date: commonMonths[i + 1] ?? commonMonths[i]!, corr }))
      .filter((r): r is { date: string; corr: number } => r.corr != null);

    // macro re-lue avec la corrélation observée pour l'interprétation d'impact.
    const macroWithCorr = readCommodityMacro(commoRows.map((r) => r.price), meta.commodityLabel, coefficient);

    result.push({
      matiere, label: meta.label, commodityLabel: meta.commodityLabel, couleur: meta.couleur,
      coefficient, beta: betaVal, nMonths: commonMonths.length, dataAvailable: true,
      points, rolling, macro: macroWithCorr, codes: meta.codes, commodityUnit,
    });
  }

  return result;
}

export interface AgroNewsItem {
  date: string;
  code: string | null;
  title: string;
  source: string | null;
}

/** Publications + événements récents des sociétés agro (contexte fondamental). */
export async function getAgroNews(): Promise<AgroNewsItem[]> {
  const supabase = createClient();
  const codes = [...new Set(Object.values(FILIERES).flatMap((f) => f.codes))];

  const [{ data: pubs }, { data: evts }] = await Promise.all([
    supabase.from('publications').select('code, date_publication, libelle').in('code', codes)
      .order('date_publication', { ascending: false }).limit(12),
    supabase.from('market_events').select('instrument_code, event_date, title').in('instrument_code', codes)
      .order('event_date', { ascending: false }).limit(12),
  ]);

  const items: AgroNewsItem[] = [
    ...((pubs ?? []) as { code: string; date_publication: string; libelle: string }[]).map((p) => ({
      date: p.date_publication, code: p.code, title: p.libelle, source: 'Publication',
    })),
    ...((evts ?? []) as { instrument_code: string | null; event_date: string; title: string }[]).map((e) => ({
      date: e.event_date, code: e.instrument_code, title: e.title, source: 'Événement',
    })),
  ];

  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}
