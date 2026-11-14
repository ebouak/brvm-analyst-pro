/**
 * Données RÉELLES des sections 3.7 et 3.8 de l'accueil (rail « Découvrir » et
 * explorateur des outils). Lecture à la clé publique (`createPublicClient`),
 * requêtes petites (PostgREST tronque à 1000 lignes en silence), chaque bloc
 * isolé : une lecture qui échoue rend `null` pour SON bloc, jamais pour la page.
 *
 * Pas de cache propre : la page a `revalidate = 300`, ce rendu est donc refait
 * au plus toutes les 5 minutes. La séance, l'indice, les cours et les signaux
 * viennent de `getLandingBisData` (passés en argument) : rien n'est relu.
 */
import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { rsi, macdSeries } from '@/lib/indicators';
import { computeYield } from '@/lib/dividends';
import { meilleursRendements } from '@/lib/dividendes/classement';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import { aggregateSeasonality } from '@/lib/seasonality/compute';
import { getMarketValuations } from '@/lib/valuation/server';
import { eventStudy, fenetreChargement } from '@/lib/eventStudy';
import { PROMPTS_TEMPLATES } from '@/lib/ai/prompts';
import { nomPays } from '@/lib/crm/geo';
import brvmSectors from '@/lib/brvmSectors.json';
import type { LandingBisData } from '@/lib/landing/bisData';
import {
  barresDividendes, fiscaliteParPays, grilleSaison, horizonsMesures, perfSerie, periodesIndice, repartitionSignaux,
  serieSansRupture, titreDividendes,
  type BarreDividende, type CelluleSaison, type LigneFiscale, type LigneScreener, type PeriodeIndice, type Repartition,
} from './outilsPur';

type Db = ReturnType<typeof createPublicClient>;

export interface DemosOutils {
  screener: { lignes: LigneScreener[]; date: string; exercice: number | null } | null;
  scanner: { code: string; rsi: number | null; macd: number | null; signal: number | null; date: string } | null;
  signaux: (Repartition & { date: string }) | null;
  saison: { code: string; nom: string | null; annees: number; cellules: CelluleSaison[] } | null;
  alpha: { code: string; nom: string | null; score: number; nbNotes: number; date: string; piliers: { libelle: string; valeur: number | null }[] } | null;
  backtest: PeriodeIndice[];
  liquidite: { date: string; lignes: { code: string; score: number; classe: string }[] } | null;
  dividendes: { exercice: number; nbSocietes: number; lignes: { code: string; rendement: number }[] } | null;
  fiscalite: LigneFiscale[];
  simulateur: { variation: number; seances: number; debut: string; fin: string } | null;
  valorisation: { nbEstimables: number; nbTotal: number; exemple: { code: string; per: number | null; pbr: number | null; roe: number | null } | null } | null;
  diagnostic: { code: string; date: string | null } | null;
  questions: { titre: string; description: string }[];
}

export interface DonneesDecouvrir {
  note: { lettre: string; code: string; nom: string | null } | null;
  dossier: { code: string; nom: string | null; secteur: string | null; pays: string | null; cours: number | null; variation: number | null } | null;
  evenement: { code: string; titre: string; date: string; horizons: { horizon: string; variation: number }[] } | null;
  dividendes: { code: string; nom: string | null; titre: string; base: string | null; barres: BarreDividende[] } | null;
  sgi: { nb: number; nbGrilles: number; pays: string[] };
}

async function essai<T>(f: () => Promise<T>, defaut: T): Promise<T> {
  try {
    return await f();
  } catch {
    return defaut;
  }
}

const isoMoins = (iso: string, jours: number) => new Date(Date.parse(`${iso}T12:00:00Z`) - jours * 86_400_000).toISOString().slice(0, 10);

/** Dividendes fiables des derniers exercices (une lecture, partagée par deux démonstrations). */
async function lireDividendes(db: Db, annee: number) {
  const { data, error } = await db
    .from('dividends')
    .select('code, exercice, montant, base_fiscale')
    .gte('exercice', annee - 3)
    .order('exercice', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as { code: string; exercice: number | null; montant: number | null; base_fiscale: string | null }[])
    .filter((r) => r.exercice != null && r.montant != null && r.montant > 0 && r.montant !== r.exercice) as { code: string; exercice: number; montant: number; base_fiscale: string | null }[];
}

/** Exercice le plus récent distribué, comme la page /dividendes. */
function exerciceRecent(rows: { exercice: number }[]): number | null {
  return rows.reduce<number | null>((m, r) => (m == null || r.exercice > m ? r.exercice : m), null);
}

export async function chargerDemosOutils(d: LandingBisData): Promise<DemosOutils> {
  const db = createPublicClient();
  const cours = new Map(d.coursSeed.map((c) => [c.code, c.cours_jour]));
  const annee = new Date().getUTCFullYear();
  const signaux = [...d.signauxSeance].sort((a, b) => b.score_total - a.score_total);
  const dateSig = signaux[0]?.date_marche ?? null;
  const top20 = signaux.slice(0, 20).map((s) => s.code);
  const codeRef = d.plusEchangee?.code ?? top20[0] ?? null;

  const [divs, histo, liquidite, alpha, saison, valos] = await Promise.all([
    essai(() => lireDividendes(db, annee), null),
    // Clôtures récentes des 20 premières valeurs (et de la valeur de référence) : ~42 séances × 21 codes < 1000.
    essai(async () => {
      if (!d.dateMarche) return null;
      const codes = [...new Set([...top20, ...(codeRef ? [codeRef] : [])])];
      if (codes.length === 0) return null;
      const { data, error } = await db
        .from('brvm_actions_daily').select('code, date_marche, cours_jour')
        .in('code', codes).gte('date_marche', isoMoins(d.dateMarche, 65)).lte('date_marche', d.dateMarche)
        .not('cours_jour', 'is', null).order('date_marche', { ascending: false }).limit(1000);
      if (error) throw error;
      const parCode = new Map<string, number[]>();
      for (const r of ((data ?? []) as { code: string; cours_jour: number }[]).slice().reverse()) {
        if (!parCode.has(r.code)) parCode.set(r.code, []);
        parCode.get(r.code)!.push(Number(r.cours_jour));
      }
      return parCode;
    }, null),
    essai(async () => {
      const { data: der } = await db.from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle();
      const date = (der?.date_marche as string | undefined) ?? null;
      if (!date) return null;
      const { data, error } = await db.from('liquidity_daily').select('code, score, classe').eq('date_marche', date).not('score', 'is', null).order('score', { ascending: false }).limit(60);
      if (error) throw error;
      return { date, lignes: ((data ?? []) as { code: string; score: number; classe: string | null }[]) };
    }, null),
    essai(async () => {
      const { data: run } = await db.from('quant_model_runs').select('id, calculation_date').eq('model_code', 'WB_COMBINED_ALPHA').order('calculation_date', { ascending: false }).limit(1).maybeSingle();
      if (!run) return null;
      const r = run as { id: string; calculation_date: string };
      const [{ data: top }, { count }] = await Promise.all([
        db.from('quant_model_scores').select('security_id, combined_alpha_score, value_score, price_momentum_score, earnings_quality_score, financial_strength_score, dividend_quality_score')
          .eq('run_id', r.id).not('combined_alpha_score', 'is', null).order('combined_alpha_score', { ascending: false }).limit(1).maybeSingle(),
        db.from('quant_model_scores').select('security_id', { count: 'exact', head: true }).eq('run_id', r.id).not('combined_alpha_score', 'is', null),
      ]);
      if (!top) return null;
      const t = top as Record<string, number | string | null>;
      const n = (v: unknown) => (v == null ? null : Number(v));
      const code = String(t.security_id);
      return {
        code, nom: d.noms[code] ?? null, score: Number(t.combined_alpha_score), nbNotes: count ?? 0, date: r.calculation_date,
        piliers: [
          { libelle: 'Valorisation', valeur: n(t.value_score) },
          { libelle: 'Momentum', valeur: n(t.price_momentum_score) },
          { libelle: 'Qualité', valeur: n(t.earnings_quality_score) },
          { libelle: 'Solidité', valeur: n(t.financial_strength_score) },
          { libelle: 'Dividende', valeur: n(t.dividend_quality_score) },
        ],
      };
    }, null),
    essai(async () => {
      if (!codeRef) return null;
      const res = aggregateSeasonality(await getMonthlyReturns(codeRef), 10);
      if (res.yearsCovered < 3) return null;
      return { code: codeRef, nom: d.noms[codeRef] ?? null, annees: res.yearsCovered, cellules: grilleSaison(res.matrix) };
    }, null),
    essai(() => getMarketValuations(), null),
  ]);

  // Dividendes : rendement du dernier exercice (même règle que /dividendes).
  const exo = divs ? exerciceRecent(divs) : null;
  const rendements = divs && exo != null
    ? meilleursRendements(divs.map((r) => ({ ...r, rendement_pct: computeYield(r.montant, cours.get(r.code) ?? null) })), exo, 60)
    : [];
  const rendementPar = new Map(rendements.map((r) => [r.code, r.rendement_pct as number]));
  const classePar = new Map((liquidite?.lignes ?? []).map((l) => [l.code, l.classe]));

  const rsiDe = (code: string) => {
    const s = histo?.get(code);
    return s ? rsi(serieSansRupture(s), 14) : null;
  };

  const screener = d.dateMarche && dateSig && top20.length > 0
    ? {
        date: dateSig, exercice: exo,
        lignes: top20.map((code) => ({ code, cours: cours.get(code) ?? null, rsi: rsiDe(code), rendement: rendementPar.get(code) ?? null, classe: classePar.get(code) ?? null })),
      }
    : null;

  let scanner: DemosOutils['scanner'] = null;
  if (codeRef && d.dateMarche && histo?.get(codeRef)) {
    const s = serieSansRupture(histo.get(codeRef)!);
    const m = s.length >= 35 ? macdSeries(s).at(-1) ?? null : null;
    const r = rsi(s, 14);
    if (r != null || m?.macd != null) scanner = { code: codeRef, rsi: r, macd: m?.macd ?? null, signal: m?.signal ?? null, date: d.dateMarche };
  }

  const nbDistrib = divs && exo != null ? new Set(divs.filter((r) => r.exercice === exo).map((r) => r.code)).size : 0;
  const estimables = valos ? valos.filter((v) => v.fairValue.fairValue != null) : [];
  const ex = valos?.find((v) => v.code === codeRef && v.metrics.per != null) ?? estimables[0] ?? null;

  return {
    screener,
    scanner,
    signaux: dateSig ? { ...repartitionSignaux(signaux), date: dateSig } : null,
    saison,
    alpha,
    backtest: periodesIndice(d.brvmCSerie),
    liquidite: liquidite && liquidite.lignes.length > 0
      ? { date: liquidite.date, lignes: liquidite.lignes.slice(0, 5).map((l) => ({ code: l.code, score: Number(l.score), classe: l.classe ?? '—' })) }
      : null,
    dividendes: exo != null && rendements.length > 0
      ? { exercice: exo, nbSocietes: nbDistrib, lignes: rendements.slice(0, 5).map((r) => ({ code: r.code, rendement: r.rendement_pct as number })) }
      : null,
    fiscalite: fiscaliteParPays(100_000),
    simulateur: perfSerie(d.brvmCSerie),
    valorisation: valos && valos.length > 0
      ? { nbEstimables: estimables.length, nbTotal: valos.length, exemple: ex ? { code: ex.code, per: ex.metrics.per, pbr: ex.metrics.pbr, roe: ex.metrics.roe } : null }
      : null,
    diagnostic: d.latestDiagnostic ? { code: d.latestDiagnostic.code, date: d.latestDiagnostic.generated_at?.slice(0, 10) ?? null } : null,
    questions: PROMPTS_TEMPLATES.filter((p) => ['flash', 'backtesting-div', 'rapport-hebdo'].includes(p.id)).map((p) => ({ titre: p.titre, description: p.description })),
  };
}

/**
 * Rail « Découvrir » : un exemple réel par carte. Une carte dont la donnée
 * manque reste, sans chiffre (le composant le gère).
 */
export async function chargerDecouvrir(d: LandingBisData): Promise<DonneesDecouvrir> {
  const db = createPublicClient();
  const ref = d.plusEchangee?.code ?? null;
  const seed = new Map(d.coursSeed.map((c) => [c.code, c]));

  const [pays, evenement, dividendes] = await Promise.all([
    essai(async () => {
      if (!ref) return null;
      const { data } = await db.from('brvm_instruments').select('pays').eq('code', ref).maybeSingle();
      const p = (data?.pays as string | null | undefined) ?? null;
      return p ? nomPays(p) : null;
    }, null),
    // Dernière publication de résultats dont la réaction est mesurable (au moins 20 jours de recul).
    essai(async () => {
      const limite = isoMoins(new Date().toISOString().slice(0, 10), 20);
      const { data } = await db.from('market_events').select('event_date, title, instrument_code').eq('event_type', 'resultats')
        .not('instrument_code', 'is', null).lte('event_date', limite).order('event_date', { ascending: false }).limit(4);
      for (const e of (data ?? []) as { event_date: string; title: string; instrument_code: string }[]) {
        const f = fenetreChargement(e.event_date);
        const [{ data: t }, { data: ix }] = await Promise.all([
          db.from('brvm_actions_daily').select('date_marche, cours_jour, volume').eq('code', e.instrument_code).gte('date_marche', f.debut).lte('date_marche', f.fin).not('cours_jour', 'is', null).order('date_marche').limit(200),
          db.from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC').gte('date_marche', f.debut).lte('date_marche', f.fin).order('date_marche').limit(200),
        ]);
        const serie = ((t ?? []) as { date_marche: string; cours_jour: number; volume: number | null }[]);
        const closes = serie.map((r) => Number(r.cours_jour));
        // Une opération sur titres dans la fenêtre fausserait la réaction : on passe à l'événement suivant.
        if (closes.length < 2 || serieSansRupture(closes).length !== closes.length) continue;
        const res = eventStudy(
          serie.map((r) => ({ date: r.date_marche, close: Number(r.cours_jour) })),
          serie.map((r) => (r.volume == null ? null : Number(r.volume))),
          ((ix ?? []) as { date_marche: string; valeur: number | null }[]).map((r) => ({ date: r.date_marche, close: r.valeur == null ? null : Number(r.valeur) })),
          e.event_date,
        );
        const horizons = res.found ? horizonsMesures(res.horizons) : [];
        if (horizons.length > 0) return { code: e.instrument_code, titre: e.title, date: e.event_date, horizons };
      }
      return null;
    }, null),
    // Barres par exercice : la valeur la plus échangée si elle a distribué, sinon la mieux notée qui l'a fait.
    essai(async () => {
      const candidats = [...new Set([ref, ...d.signauxSeance.slice().sort((a, b) => b.score_total - a.score_total).map((s) => s.code)].filter((c): c is string => !!c))].slice(0, 6);
      if (candidats.length === 0) return null;
      const { data } = await db.from('dividends').select('code, exercice, montant, base_fiscale').in('code', candidats).limit(400);
      const rows = (data ?? []) as { code: string; exercice: number | null; montant: number | null; base_fiscale: string | null }[];
      for (const code of candidats) {
        const siens = rows.filter((r) => r.code === code);
        const barres = barresDividendes(siens);
        const titre = titreDividendes(barres);
        if (barres.length >= 3 && titre) {
          const retenus = siens.filter((r) => barres.some((b) => b.exercice === r.exercice && b.montant === r.montant));
          const bases = new Set(retenus.map((r) => r.base_fiscale ?? 'inconnu'));
          return { code, nom: d.noms[code] ?? null, titre, base: bases.size === 1 ? [...bases][0] : null, barres };
        }
      }
      return null;
    }, null),
  ]);

  const c = ref ? seed.get(ref) : undefined;
  return {
    note: d.topNote?.grade ? { lettre: d.topNote.grade, code: d.topNote.code, nom: d.topNote.nom } : null,
    dossier: ref
      ? { code: ref, nom: d.noms[ref] ?? null, secteur: (brvmSectors as Record<string, string>)[ref] ?? null, pays, cours: c?.cours_jour ?? null, variation: c?.variation_pct ?? null }
      : null,
    evenement,
    dividendes,
    sgi: d.sgi,
  };
}
