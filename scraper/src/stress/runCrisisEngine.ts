/**
 * Runners Phase 1 — Historical Crisis Engine :
 *   - `runImportIndices` : import historique Sikafinance ou CSV administrateur
 *   - `runImportMacro`   : collecte historique macroéconomique UEMOA (BCEAO + BM)
 *   - `runCrisisEngine`  : détection automatique des drawdowns, contexte sourcé,
 *                          scores de similarité et rapport de couverture.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { parseIndexCsv } from './import/csvImporter.js';
import { collecterHistoriqueSikafinance, MAPPING_INDICES_SIKA } from './import/sikafinanceIndices.js';
import { BCEAO_TAUX_HISTORIQUES, collecterMacroUemoa, type MacroHistoryRow } from './import/macroUemoa.js';
import {
  construireContexteEpisode,
  type ActionDayMetric,
  type EventRow,
  type MacroRow,
  type NervositeRow,
} from './pure/contexteHistorique.js';
import { calculerRapportCouverture, validerSerieIndice } from './pure/dataQuality.js';
import { detecterEpisodes } from './pure/drawdowns.js';
import { calculerSimilarite } from './pure/similarity.js';
import { SEUILS_CRISES, type EpisodeCrise, type PointIndice, type RapportCouverture } from './pure/types.js';

const PAGE = 1000;
const BATCH = 500;

export interface ImportIndicesOptions {
  mock?: boolean;
  dryRun?: boolean;
  csvPath?: string;
  indiceCode?: string;
  fromYear?: number;
}

export interface ImportIndicesResult {
  status: 'success' | 'mock' | 'partial' | 'failed';
  indicesTraites: number;
  lignesCollectees: number;
  lignesInserees: number;
  anomaliesTotal: number;
  rapportPath: string | null;
}

export interface ImportMacroResult {
  status: 'success' | 'mock' | 'failed';
  lignesCollectees: number;
  lignesEcrites: number;
}

export interface CrisisEngineResult {
  status: 'success' | 'mock' | 'failed';
  indicesAnalyses: number;
  episodesDetectes: number;
  episodesEcrits: number;
  couvertures: RapportCouverture[];
  raison?: string;
}

function serieMockBRVMC(): PointIndice[] {
  // Fixture déterministe simulant 3 crises complètes (~ -14 %, -24 %, -35 %) + correction en cours (-18 %)
  const out: PointIndice[] = [];
  let val = 100;
  let day = 0;
  const start = Date.UTC(2007, 0, 2);
  const pushDay = (v: number) => {
    let dt = new Date(start + day * 86_400_000);
    while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) {
      day++;
      dt = new Date(start + day * 86_400_000);
    }
    out.push({
      date_marche: dt.toISOString().slice(0, 10),
      valeur: Math.round(v * 100) / 100,
      source: 'mock',
      qualite: 'mock',
    });
    day++;
  };

  // Phase 1 : hausse jusqu'à 220 (60 séances)
  for (let i = 0; i < 60; i++) { val *= 1.013; pushDay(val); }
  // Crise 1 : -35 % sur 90 séances puis reprise en 140 séances
  for (let i = 0; i < 90; i++) { val *= 0.9952; pushDay(val); }
  for (let i = 0; i < 140; i++) { val *= 1.0033; pushDay(val); }
  // Phase 2 : plateau haussier
  for (let i = 0; i < 80; i++) { val *= 1.003; pushDay(val); }
  // Crise 2 : -24 % sur 70 séances puis reprise en 90 séances
  for (let i = 0; i < 70; i++) { val *= 0.9961; pushDay(val); }
  for (let i = 0; i < 90; i++) { val *= 1.0034; pushDay(val); }
  // Phase 3 : sommet 2026
  for (let i = 0; i < 120; i++) { val *= 1.005; pushDay(val); }
  // Correction en cours : -18 % sur 45 séances
  for (let i = 0; i < 45; i++) { val *= 0.9956; pushDay(val); }

  return out;
}

async function lirePage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await fetchPage(offset, offset + PAGE - 1);
    if (error) throw new Error(`lecture ${label} : ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function ensureIndexInstrument(sb: SupabaseClient, code: string, libelle: string): Promise<void> {
  const { error } = await sb
    .from('brvm_instruments')
    .upsert([{ code, designation: libelle, type: 'indice', actif: true }], {
      onConflict: 'code',
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`upsert brvm_instruments (${code}) : ${error.message}`);
}

const TABLE_INDICES_HIST = 'stress_indices_history';

export async function runImportIndices(opts: ImportIndicesOptions = {}): Promise<ImportIndicesResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);

  if (mock) {
    const serie = serieMockBRVMC();
    const cov = calculerRapportCouverture('BRVMC', serie);
    logger.info({ code: 'BRVMC', seances: cov.nb_seances_disponibles, couverturePct: cov.couverture_pct }, '[mock] Import indices simulé');
    return {
      status: 'mock',
      indicesTraites: 1,
      lignesCollectees: serie.length,
      lignesInserees: 0,
      anomaliesTotal: 0,
      rapportPath: null,
    };
  }

  const sb = getSupabase();
  const rapports: Array<{ code: string; couverture: RapportCouverture; anomalies: number; source: string }> = [];
  let lignesCollectees = 0;
  let lignesInserees = 0;
  let anomaliesTotal = 0;
  let echecs = 0;

  if (opts.csvPath) {
    const code = (opts.indiceCode ?? 'BRVMC').toUpperCase();
    const raw = fs.readFileSync(path.resolve(opts.csvPath), 'utf8');
    const parsed = parseIndexCsv(raw, code, `csv:${path.basename(opts.csvPath)}`);
    const cov = calculerRapportCouverture(code, parsed.seriePropre);
    lignesCollectees += parsed.seriePropre.length;
    anomaliesTotal += parsed.anomalies.length;
    rapports.push({ code, couverture: cov, anomalies: parsed.anomalies.length, source: `csv:${path.basename(opts.csvPath)}` });

    if (!dryRun && parsed.seriePropre.length > 0) {
      const libelle = MAPPING_INDICES_SIKA.find((m) => m.codeWb === code)?.libelle ?? code;
      await ensureIndexInstrument(sb, code, libelle);
      for (let i = 0; i < parsed.seriePropre.length; i += BATCH) {
        const batch = parsed.seriePropre.slice(i, i + BATCH).map((p, idx) => {
          const prev = i + idx > 0 ? parsed.seriePropre[i + idx - 1]!.valeur : null;
          return {
            code,
            date_marche: p.date_marche,
            libelle,
            valeur: p.valeur,
            valeur_precedente: prev,
            variation_pct: p.variation_pct ?? null,
            volume: p.volume ?? null,
            capitalisation: p.capitalisation ?? null,
            source: p.source ?? 'csv',
            qualite: p.qualite ?? 'import_csv_valide',
          };
        });
        const { error } = await sb
          .from(TABLE_INDICES_HIST)
          .upsert(batch, { onConflict: 'code,date_marche', ignoreDuplicates: false });
        if (error) throw new Error(`upsert ${TABLE_INDICES_HIST} (${code}) : ${error.message}`);
        lignesInserees += batch.length;
      }
    }
  } else {
    const cibles = opts.indiceCode
      ? MAPPING_INDICES_SIKA.filter((m) => m.codeWb === opts.indiceCode!.toUpperCase() || m.sikaTicker === opts.indiceCode!.toUpperCase())
      : MAPPING_INDICES_SIKA;

    const debutForce = opts.fromYear ? `${opts.fromYear}-01-01` : undefined;

    for (const m of cibles) {
      try {
        const res = await collecterHistoriqueSikafinance(m, { debut: debutForce });
        const cov = calculerRapportCouverture(m.codeWb, res.seriePropre);
        lignesCollectees += res.seriePropre.length;
        anomaliesTotal += res.anomalies.length;
        rapports.push({ code: m.codeWb, couverture: cov, anomalies: res.anomalies.length, source: 'sikafinance' });

        logger.info(
          { code: m.codeWb, sika: m.sikaTicker, seances: res.seriePropre.length, debut: cov.debut_date, fin: cov.fin_date, anomalies: res.anomalies.length },
          '[stress:import-indices] Collecte terminée',
        );

        if (!dryRun && res.seriePropre.length > 0) {
          await ensureIndexInstrument(sb, m.codeWb, m.libelle);
          for (let i = 0; i < res.seriePropre.length; i += BATCH) {
            const batch = res.seriePropre.slice(i, i + BATCH).map((p, idx) => {
              const prev = i + idx > 0 ? res.seriePropre[i + idx - 1]!.valeur : null;
              return {
                code: m.codeWb,
                date_marche: p.date_marche,
                libelle: m.libelle,
                valeur: p.valeur,
                valeur_precedente: prev,
                variation_pct: p.variation_pct ?? null,
                volume: p.volume ?? null,
                source: 'sikafinance',
                qualite: 'historique_reconstitue',
              };
            });
            const { error } = await sb
              .from(TABLE_INDICES_HIST)
              .upsert(batch, { onConflict: 'code,date_marche', ignoreDuplicates: false });
            if (error) throw new Error(`upsert ${TABLE_INDICES_HIST} (${m.codeWb}) : ${error.message}`);
            lignesInserees += batch.length;
          }
        }
      } catch (err) {
        echecs++;
        logger.error({ code: m.codeWb, err: err instanceof Error ? err.message : String(err) }, '[stress:import-indices] Échec collecte');
      }
    }

    if (!dryRun && rapports.length > 0) {
      const brvmc = rapports.find((r) => r.code === 'BRVMC')?.couverture ?? rapports[0]!.couverture;
      await sb.from('stress_data_sources').upsert(
        {
          code_source: 'sikafinance_indices',
          libelle: 'Sikafinance — Historique quotidien indices BRVM (table stress_indices_history)',
          type_source: 'api_historique',
          url: 'https://www.sikafinance.com/marches/historiques/BRVMC',
          debut_date: brvmc.debut_date,
          fin_date: brvmc.fin_date,
          nb_seances_disponibles: brvmc.nb_seances_disponibles,
          nb_seances_manquantes: brvmc.nb_seances_manquantes,
          couverture_pct: brvmc.couverture_pct,
          indices_disponibles: rapports.map((r) => r.code),
          statut: echecs > 0 ? 'partiel' : 'actif',
          metadata: { rapports },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'code_source' },
      );
    }
  }

  const outDir = path.resolve(process.cwd(), 'output', 'stress');
  fs.mkdirSync(outDir, { recursive: true });
  const rapportPath = path.join(outDir, `import-indices-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(rapportPath, JSON.stringify({ dryRun, rapports, lignesCollectees, lignesInserees, anomaliesTotal }, null, 2));

  return {
    status: echecs > 0 && rapports.length === 0 ? 'failed' : echecs > 0 ? 'partial' : 'success',
    indicesTraites: rapports.length,
    lignesCollectees,
    lignesInserees,
    anomaliesTotal,
    rapportPath,
  };
}

export async function runImportMacro(opts: { mock?: boolean; dryRun?: boolean } = {}): Promise<ImportMacroResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);

  if (mock) {
    logger.info({ bceao: BCEAO_TAUX_HISTORIQUES.length }, '[mock] Import macro UEMOA simulé');
    return { status: 'mock', lignesCollectees: BCEAO_TAUX_HISTORIQUES.length, lignesEcrites: 0 };
  }

  const rows: MacroHistoryRow[] = await collecterMacroUemoa();
  if (dryRun) {
    logger.info({ lignes: rows.length }, '[DRY_RUN] stress_macro_history sauté');
    return { status: 'success', lignesCollectees: rows.length, lignesEcrites: 0 };
  }

  const sb = getSupabase();
  // Purge préalable des séries curées BCEAO pour éliminer toute date erronée antérieure
  const { error: delErr } = await sb
    .from('stress_macro_history')
    .delete()
    .in('indicateur', ['bceao_taux_directeur', 'bceao_guichet_marginal'])
    .eq('zone', 'UEMOA');
  if (delErr) throw new Error(`purge bceao stress_macro_history : ${delErr.message}`);

  let ecrits = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from('stress_macro_history')
      .upsert(batch, { onConflict: 'indicateur,zone,date_valeur' });
    if (error) throw new Error(`upsert stress_macro_history : ${error.message}`);
    ecrits += batch.length;
  }

  return { status: 'success', lignesCollectees: rows.length, lignesEcrites: ecrits };
}

export async function runCrisisEngine(
  opts: { mock?: boolean; dryRun?: boolean; indiceCode?: string; seuils?: readonly number[] } = {},
): Promise<CrisisEngineResult> {
  const mock = Boolean(opts.mock);
  const dryRun = opts.dryRun ?? (!mock && getConfig().DRY_RUN);
  const seuils = opts.seuils ?? SEUILS_CRISES;

  if (mock) {
    const serie = serieMockBRVMC();
    const { seriePropre } = validerSerieIndice('BRVMC', serie);
    const cov = calculerRapportCouverture('BRVMC', seriePropre);
    const episodes: EpisodeCrise[] = [];
    for (const s of seuils) {
      episodes.push(...detecterEpisodes(seriePropre, 'BRVMC', { seuilDeclenchementPct: s }));
    }
    const courant = episodes.filter((e) => e.seuil_pct === -10 && e.statut === 'en_cours').at(-1) ?? episodes.at(-1);
    if (courant) {
      for (const ep of episodes) {
        if (ep.date_sommet === courant.date_sommet && ep.seuil_pct === courant.seuil_pct) {
          ep.similarite_actuelle = 100;
        } else {
          const sim = calculerSimilarite(courant, ep);
          ep.similarite_actuelle = sim.score;
          ep.similarite_details = sim;
        }
      }
    }
    logger.info(
      { episodes: episodes.length, couverturePct: cov.couverture_pct, enCours: episodes.filter((e) => e.statut === 'en_cours').length },
      '[mock] Historical Crisis Engine exécuté',
    );
    return {
      status: 'mock',
      indicesAnalyses: 1,
      episodesDetectes: episodes.length,
      episodesEcrits: 0,
      couvertures: [cov],
    };
  }

  const sb = getSupabase();

  // 1. Chargement paginé des séries disponibles (brvm_indices_daily + stress_indices_history fusionnées)
  const [indicesOfficiels, indicesHistoriques, nervRaw, macroRaw, eventsRaw, instRaw] = await Promise.all([
    lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null; source?: string | null; qualite?: string | null }>(
      (from, to) =>
        sb
          .from('brvm_indices_daily')
          .select('code, date_marche, valeur, variation_pct, source, qualite')
          .order('date_marche', { ascending: true })
          .order('code', { ascending: true })
          .range(from, to),
      'brvm_indices_daily',
    ),
    lirePage<{ code: string; date_marche: string; valeur: number; variation_pct: number | null; source: string | null; qualite: string | null }>(
      (from, to) =>
        sb
          .from(TABLE_INDICES_HIST)
          .select('code, date_marche, valeur, variation_pct, source, qualite')
          .order('date_marche', { ascending: true })
          .order('code', { ascending: true })
          .range(from, to),
      TABLE_INDICES_HIST,
    ).catch(() => []),
    lirePage<NervositeRow>(
      (from, to) =>
        sb.from('brvm_nervosite_daily').select('date_marche, valeur').order('date_marche', { ascending: true }).range(from, to),
      'brvm_nervosite_daily',
    ),
    lirePage<MacroRow>(
      (from, to) =>
        sb.from('stress_macro_history').select('indicateur, zone, date_valeur, valeur, unite, source').order('date_valeur', { ascending: true }).range(from, to),
      'stress_macro_history',
    ).catch(() => [] as MacroRow[]),
    lirePage<EventRow>(
      (from, to) =>
        sb
          .from('market_events')
          .select('event_date, instrument_code, event_type, title, source, importance_level')
          .order('event_date', { ascending: true })
          .range(from, to),
      'market_events',
    ),
    lirePage<{ code: string; secteur: string | null }>(
      (from, to) => sb.from('brvm_instruments').select('code, secteur').eq('type', 'action').range(from, to),
      'brvm_instruments',
    ),
  ]);

  // Fusionner par (code, date_marche) en donnant priorité absolue à brvm_indices_daily
  const fusion = new Map<string, { code: string; date_marche: string; valeur: number; variation_pct: number | null; source: string | null; qualite: string | null }>();
  for (const r of indicesHistoriques) {
    const d = String(r.date_marche).slice(0, 10);
    fusion.set(`${r.code}:${d}`, { ...r, date_marche: d });
  }
  for (const r of indicesOfficiels) {
    const d = String(r.date_marche).slice(0, 10);
    fusion.set(`${r.code}:${d}`, {
      code: r.code,
      date_marche: d,
      valeur: Number(r.valeur),
      variation_pct: r.variation_pct != null ? Number(r.variation_pct) : null,
      source: r.source ?? 'brvm_officiel',
      qualite: r.qualite ?? 'officiel',
    });
  }
  const indicesRaw = [...fusion.values()];

  const secteurParCode = new Map(instRaw.map((i) => [i.code, i.secteur]));

  // Grouper les séries d'indices par code
  const parIndice = new Map<string, PointIndice[]>();
  for (const r of indicesRaw) {
    if (opts.indiceCode && r.code !== opts.indiceCode.toUpperCase()) continue;
    const arr = parIndice.get(r.code) ?? [];
    arr.push({
      date_marche: String(r.date_marche).slice(0, 10),
      valeur: Number(r.valeur),
      variation_pct: r.variation_pct != null ? Number(r.variation_pct) : null,
      source: r.source,
      qualite: r.qualite,
    });
    parIndice.set(r.code, arr);
  }

  if (parIndice.size === 0) {
    return {
      status: 'failed',
      indicesAnalyses: 0,
      episodesDetectes: 0,
      episodesEcrits: 0,
      couvertures: [],
      raison: 'Aucune série dans brvm_indices_daily',
    };
  }

  // Charger les cours actions uniquement sur les dates utiles (optimisé si BRVMC couvre des années)
  const actionsRaw = await lirePage<{
    date_marche: string;
    code: string;
    cours_jour: number | null;
    variation_pct: number | null;
    volume: number | null;
  }>(
    (from, to) =>
      sb
        .from('brvm_actions_daily')
        .select('date_marche, code, cours_jour, variation_pct, volume')
        .gte('date_marche', '2007-01-01')
        .order('date_marche', { ascending: true })
        .order('code', { ascending: true })
        .range(from, to),
    'brvm_actions_daily',
  );

  const actionsMetrics: ActionDayMetric[] = actionsRaw.map((a) => ({
    date_marche: String(a.date_marche).slice(0, 10),
    code: a.code,
    secteur: secteurParCode.get(a.code) ?? null,
    cours_jour: a.cours_jour != null ? Number(a.cours_jour) : null,
    variation_pct: a.variation_pct != null ? Number(a.variation_pct) : null,
    volume: a.volume != null ? Number(a.volume) : null,
  }));

  // Volume moyen quotidien global sur l'ensemble pour normaliser le volume relatif
  const volParJour = new Map<string, number>();
  for (const a of actionsMetrics) {
    if (a.volume != null && a.volume > 0) {
      volParJour.set(a.date_marche, (volParJour.get(a.date_marche) ?? 0) + a.volume);
    }
  }
  const volumeBaselineMoyen =
    volParJour.size > 0 ? [...volParJour.values()].reduce((s, v) => s + v, 0) / volParJour.size : null;

  const couvertures: RapportCouverture[] = [];
  const tousEpisodes: EpisodeCrise[] = [];

  for (const [code, brut] of parIndice.entries()) {
    const { seriePropre } = validerSerieIndice(code, brut);
    const cov = calculerRapportCouverture(code, seriePropre);
    couvertures.push(cov);

    const epsIndice: EpisodeCrise[] = [];
    for (const s of seuils) {
      const detectes = detecterEpisodes(seriePropre, code, { seuilDeclenchementPct: s });
      for (const ep of detectes) {
        const ctx = construireContexteEpisode(ep, {
          nervosite: nervRaw,
          macroRows: macroRaw,
          events: eventsRaw,
          actionsWindow: actionsMetrics,
          volumeBaselineMoyen,
        });
        ep.contexte_marche = ctx.contexte_marche;
        ep.contexte_macro = ctx.contexte_macro;
        ep.contexte_entreprises = ctx.contexte_entreprises;
        epsIndice.push(ep);
      }
    }

    // Référence pour le score de similarité : épisode en cours au seuil -10 % (sinon le plus récent)
    const ref =
      epsIndice.filter((e) => e.seuil_pct === -10 && e.statut === 'en_cours').at(-1) ??
      epsIndice.filter((e) => e.statut === 'en_cours').at(-1) ??
      epsIndice.at(-1);

    if (ref) {
      for (const ep of epsIndice) {
        if (ep.date_sommet === ref.date_sommet && ep.seuil_pct === ref.seuil_pct) {
          ep.similarite_actuelle = 100;
          ep.similarite_details = null;
        } else {
          const sim = calculerSimilarite(ref, ep);
          ep.similarite_actuelle = sim.score;
          ep.similarite_details = sim;
        }
      }
    }

    tousEpisodes.push(...epsIndice);
  }

  if (dryRun) {
    logger.info(
      { indicesAnalyses: couvertures.length, episodesDetectes: tousEpisodes.length },
      '[DRY_RUN] upsert stress_crisis_episodes sauté',
    );
    return {
      status: 'success',
      indicesAnalyses: couvertures.length,
      episodesDetectes: tousEpisodes.length,
      episodesEcrits: 0,
      couvertures,
    };
  }

  let ecrits = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < tousEpisodes.length; i += BATCH) {
    const batch = tousEpisodes.slice(i, i + BATCH).map((e) => ({
      indice_code: e.indice_code,
      seuil_pct: e.seuil_pct,
      niveau: e.niveau,
      libelle: e.libelle,
      date_sommet: e.date_sommet,
      valeur_sommet: e.valeur_sommet,
      date_debut_correction: e.date_debut_correction,
      date_creux: e.date_creux,
      valeur_creux: e.valeur_creux,
      perte_max_pct: e.perte_max_pct,
      nb_seances_baisse: e.nb_seances_baisse,
      duree_calendaire_baisse: e.duree_calendaire_baisse,
      nb_rebonds_intermediaires: e.nb_rebonds_intermediaires,
      amplitude_max_rebond_pct: e.amplitude_max_rebond_pct,
      date_recuperation: e.date_recuperation,
      nb_seances_rebond: e.nb_seances_rebond,
      duree_totale_recuperation_jours: e.duree_totale_recuperation_jours,
      perf_cumulee_recuperation_pct: e.perf_cumulee_recuperation_pct,
      statut: e.statut,
      rebond_1m_pct: e.rebond_1m_pct,
      rebond_3m_pct: e.rebond_3m_pct,
      rebond_6m_pct: e.rebond_6m_pct,
      rebond_12m_pct: e.rebond_12m_pct,
      rebond_24m_pct: e.rebond_24m_pct,
      similarite_actuelle: e.similarite_actuelle ?? null,
      similarite_details: e.similarite_details ?? null,
      contexte_marche: e.contexte_marche ?? {},
      contexte_macro: e.contexte_macro ?? {},
      contexte_entreprises: e.contexte_entreprises ?? {},
      trajectoire_base100: e.trajectoire_base100,
      methode_version: '1.0',
      updated_at: now,
    }));
    const { error } = await sb
      .from('stress_crisis_episodes')
      .upsert(batch, { onConflict: 'indice_code,seuil_pct,date_sommet' });
    if (error) throw new Error(`upsert stress_crisis_episodes : ${error.message}`);
    ecrits += batch.length;
  }

  // Enregistrer le rapport de couverture consolidé dans stress_data_sources
  const brvmcCov = couvertures.find((c) => c.indice_code === 'BRVMC') ?? couvertures[0]!;
  await sb.from('stress_data_sources').upsert(
    {
      code_source: 'brvm_indices_consolidates',
      libelle: 'Série consolidée des indices BRVM (BRVM officiel + historiques validés)',
      type_source: 'base_consolidee',
      url: 'https://www.brvm.org',
      debut_date: brvmcCov.debut_date,
      fin_date: brvmcCov.fin_date,
      nb_seances_disponibles: brvmcCov.nb_seances_disponibles,
      nb_seances_manquantes: brvmcCov.nb_seances_manquantes,
      couverture_pct: brvmcCov.couverture_pct,
      indices_disponibles: couvertures.map((c) => c.indice_code),
      statut: 'actif',
      metadata: { couvertures },
      updated_at: now,
    },
    { onConflict: 'code_source' },
  );

  return {
    status: 'success',
    indicesAnalyses: couvertures.length,
    episodesDetectes: tousEpisodes.length,
    episodesEcrits: ecrits,
    couvertures,
  };
}
