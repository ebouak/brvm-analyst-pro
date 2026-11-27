import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculerDrawdowns, detecterEpisodes } from './drawdowns';
import { SEUILS_CRISES, type EpisodeCrise, type PointIndice } from './types';

const PAGE = 1000;

export interface IndiceSnapshotActuel {
  code: string;
  libelle: string;
  derniere_seance: string;
  valeur: number;
  variation_pct: number | null;
  sommet_observe: number;
  date_sommet: string;
  drawdown_pct: number;
  seances_disponibles: number;
  debut_serie: string;
}

export interface NervositeActuelle {
  date_marche: string;
  valeur: number | null;
  rapide: number | null;
  lente: number | null;
  rang: number | null;
  regime: string | null;
  n_titres: number;
}

export interface CouvertureSource {
  code_source: string;
  libelle: string;
  debut_date: string | null;
  fin_date: string | null;
  nb_seances_disponibles: number;
  couverture_pct: number | null;
  indices_disponibles: string[];
  updated_at: string;
}

export interface DonneesCrisesModule {
  source_mode: 'table_precalculee' | 'calcul_live_brvm_indices';
  derniere_seance: string | null;
  indices_actuels: IndiceSnapshotActuel[];
  nervosite: NervositeActuelle | null;
  episodes: EpisodeCrise[];
  couverture: CouvertureSource | null;
}

async function lireTableIndices(
  sb: SupabaseClient,
  table: 'brvm_indices_daily' | 'stress_indices_history',
): Promise<
  Array<{
    code: string;
    libelle: string | null;
    date_marche: string;
    valeur: number | null;
    variation_pct: number | null;
  }>
> {
  const out: Array<{
    code: string;
    libelle: string | null;
    date_marche: string;
    valeur: number | null;
    variation_pct: number | null;
  }> = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select('code, libelle, date_marche, valeur, variation_pct')
      .order('date_marche', { ascending: true })
      .order('code', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      // Tolérant si stress_indices_history n'est pas encore créée (avant 0277)
      if (table === 'brvm_indices_daily') console.error(`[stress] lecture ${table} :`, error.message);
      return out;
    }
    const rows = (data ?? []) as typeof out;
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function lireTousIndices(sb: SupabaseClient) {
  const [officiels, historiques] = await Promise.all([
    lireTableIndices(sb, 'brvm_indices_daily'),
    lireTableIndices(sb, 'stress_indices_history'),
  ]);
  const map = new Map<string, (typeof officiels)[number]>();
  for (const r of historiques) map.set(`${r.code}:${String(r.date_marche).slice(0, 10)}`, r);
  for (const r of officiels) map.set(`${r.code}:${String(r.date_marche).slice(0, 10)}`, r);
  return [...map.values()];
}

async function lireEpisodesPrecalcules(
  sb: SupabaseClient,
  indiceCode?: string,
): Promise<EpisodeCrise[] | null> {
  const out: EpisodeCrise[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = sb
      .from('stress_crisis_episodes')
      .select('*')
      .order('date_sommet', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (indiceCode) q = q.eq('indice_code', indiceCode);
    const { data, error } = await q;
    if (error) {
      // Table absente avant migration 0276 ou erreur de lecture → repli gracieux
      return null;
    }
    const rows = (data ?? []) as EpisodeCrise[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function chargerDonneesCrises(
  sb: SupabaseClient,
  opts: { indiceCode?: string } = {},
): Promise<DonneesCrisesModule> {
  const [indicesRaw, nervRes, precalcules, sourcesRes] = await Promise.all([
    lireTousIndices(sb),
    sb
      .from('brvm_nervosite_daily')
      .select('date_marche, valeur, rapide, lente, rang, regime, n_titres')
      .order('date_marche', { ascending: false })
      .limit(1),
    lireEpisodesPrecalcules(sb, opts.indiceCode),
    sb
      .from('stress_data_sources')
      .select('code_source, libelle, debut_date, fin_date, nb_seances_disponibles, couverture_pct, indices_disponibles, updated_at')
      .eq('code_source', 'brvm_indices_consolidates')
      .limit(1),
  ]);

  // Grouper les séries d'indices observées pour calculer les snapshots actuels
  const parIndice = new Map<string, { libelle: string; points: PointIndice[] }>();
  for (const r of indicesRaw) {
    if (r.valeur == null || !(Number(r.valeur) > 0)) continue;
    const entry = parIndice.get(r.code) ?? { libelle: r.libelle ?? r.code, points: [] };
    entry.points.push({
      date_marche: String(r.date_marche).slice(0, 10),
      valeur: Number(r.valeur),
      variation_pct: r.variation_pct != null ? Number(r.variation_pct) : null,
    });
    parIndice.set(r.code, entry);
  }

  const indices_actuels: IndiceSnapshotActuel[] = [];
  for (const [code, { libelle, points }] of parIndice.entries()) {
    const dd = calculerDrawdowns(points);
    const dernier = dd.at(-1);
    const dernierPt = points.at(-1);
    if (!dernier || !dernierPt) continue;
    indices_actuels.push({
      code,
      libelle,
      derniere_seance: dernier.date_marche,
      valeur: dernier.valeur,
      variation_pct: dernierPt.variation_pct ?? null,
      sommet_observe: dernier.sommet_precedent,
      date_sommet: dernier.date_sommet_precedent,
      drawdown_pct: dernier.drawdown_pct,
      seances_disponibles: dd.length,
      debut_serie: dd[0]!.date_marche,
    });
  }

  // Trier : principaux d'abord (BRVMC, BRVM30, BRVMPRES, BRVMPRIN), puis sectoriels par drawdown
  const ordre = ['BRVMC', 'BRVM30', 'BRVMPRES', 'BRVMPRIN'];
  indices_actuels.sort((a, b) => {
    const ia = ordre.indexOf(a.code);
    const ib = ordre.indexOf(b.code);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.drawdown_pct - b.drawdown_pct;
  });

  const derniere_seance = indices_actuels.find((i) => i.code === 'BRVMC')?.derniere_seance
    ?? indices_actuels[0]?.derniere_seance
    ?? null;

  const nervosite: NervositeActuelle | null =
    !nervRes.error && nervRes.data?.[0]
      ? {
          date_marche: String(nervRes.data[0].date_marche).slice(0, 10),
          valeur: nervRes.data[0].valeur != null ? Number(nervRes.data[0].valeur) : null,
          rapide: nervRes.data[0].rapide != null ? Number(nervRes.data[0].rapide) : null,
          lente: nervRes.data[0].lente != null ? Number(nervRes.data[0].lente) : null,
          rang: nervRes.data[0].rang != null ? Number(nervRes.data[0].rang) : null,
          regime: (nervRes.data[0].regime as string | null) ?? null,
          n_titres: Number(nervRes.data[0].n_titres ?? 0),
        }
      : null;

  // Utiliser la table pré-calculée si peuplée ; sinon calcul live sur brvm_indices_daily réel
  let episodes: EpisodeCrise[] = [];
  let source_mode: DonneesCrisesModule['source_mode'] = 'calcul_live_brvm_indices';

  if (precalcules && precalcules.length > 0) {
    episodes = precalcules;
    source_mode = 'table_precalculee';
  } else {
    for (const [code, { points }] of parIndice.entries()) {
      if (opts.indiceCode && code !== opts.indiceCode) continue;
      for (const s of SEUILS_CRISES) {
        episodes.push(...detecterEpisodes(points, code, { seuilDeclenchementPct: s }));
      }
    }
    episodes.sort((a, b) => b.date_sommet.localeCompare(a.date_sommet));
  }

  let couverture: CouvertureSource | null = null;
  if (!sourcesRes.error && sourcesRes.data?.[0]) {
    const s = sourcesRes.data[0] as Record<string, unknown>;
    couverture = {
      code_source: String(s.code_source),
      libelle: String(s.libelle),
      debut_date: (s.debut_date as string | null) ?? null,
      fin_date: (s.fin_date as string | null) ?? null,
      nb_seances_disponibles: Number(s.nb_seances_disponibles ?? 0),
      couverture_pct: s.couverture_pct != null ? Number(s.couverture_pct) : null,
      indices_disponibles: Array.isArray(s.indices_disponibles) ? (s.indices_disponibles as string[]) : [],
      updated_at: String(s.updated_at ?? ''),
    };
  } else {
    const brvmc = indices_actuels.find((i) => i.code === 'BRVMC') ?? indices_actuels[0];
    if (brvmc) {
      couverture = {
        code_source: 'brvm_indices_daily',
        libelle: 'BRVM officiel (table brvm_indices_daily en base)',
        debut_date: brvmc.debut_serie,
        fin_date: brvmc.derniere_seance,
        nb_seances_disponibles: brvmc.seances_disponibles,
        couverture_pct: null,
        indices_disponibles: indices_actuels.map((i) => i.code),
        updated_at: new Date().toISOString(),
      };
    }
  }

  return {
    source_mode,
    derniere_seance,
    indices_actuels,
    nervosite,
    episodes,
    couverture,
  };
}
