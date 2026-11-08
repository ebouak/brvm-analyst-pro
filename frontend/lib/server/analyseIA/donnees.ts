import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastMarketDate } from '@/lib/marketDate';
import { resumerHistorique, type ResumeHistorique } from '@/lib/analyseIA/historique';
import { lireTechnique, type LectureTechniqueIA } from '@/lib/analyseIA/technique';
import { plusRecente } from '@/lib/analyseIA/sources';
import type {
  Actualite,
  CarnetSeance,
  ComptesExercice,
  CoursJour,
  LigneDividende,
  MesureLiquidite,
  PointCours,
  Publication,
  SourceDonnee,
} from '@/lib/analyseIA/types';

/**
 * Lecture, pour UNE valeur, de tout ce que WESTBOURSE enregistre à son sujet.
 * LECTURE SEULE, client à la clé publique soumis à la RLS (jamais service_role) :
 * l'assistant ne voit que ce que la page publique laisse voir.
 * Chaque lecteur rend la donnée ET sa source datée (élément le plus récent).
 */

export interface Lu<T> {
  donnees: T;
  source: SourceDonnee;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const num = (x: unknown): number | null => (x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const tronquer = (s: unknown, n: number) => (typeof s === 'string' ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

/** PostgREST tronque à 1000 lignes EN SILENCE : on pagine jusqu'au bout. */
const PAGE = 1000;
const PLAFOND_LIGNES = 30_000;

export async function lireSeances(db: SupabaseClient, code: string): Promise<PointCours[]> {
  const pts: PointCours[] = [];
  for (let de = 0; de < PLAFOND_LIGNES; de += PAGE) {
    const { data, error } = await db
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour, volume, variation_pct')
      .eq('code', code)
      .not('cours_jour', 'is', null)
      .order('date_marche', { ascending: true })
      .range(de, de + PAGE - 1);
    if (error) throw new Error('seances');
    for (const r of data ?? []) {
      const c = num(r.cours_jour);
      if (c != null && c > 0) pts.push({ date: r.date_marche as string, cours: c, volume: num(r.volume), variation_pct: num(r.variation_pct) });
    }
    if (!data || data.length < PAGE) break;
  }
  return pts;
}

export async function lireCoursJour(db: SupabaseClient, code: string, nom: string | null): Promise<Lu<CoursJour | null>> {
  const asOf = await getLastMarketDate(db);
  const source = { libelle: 'Cotation de la dernière séance (BRVM)', date: asOf };
  if (!asOf) return { donnees: null, source };
  const { data } = await db
    .from('brvm_actions_daily')
    .select('cours_jour, variation_pct, cours_precedent, volume, valeur_echangee')
    .eq('date_marche', asOf)
    .eq('code', code)
    .maybeSingle();
  if (!data) return { donnees: null, source };
  return {
    donnees: {
      code,
      societe: nom,
      seance: asOf,
      cours: num(data.cours_jour),
      variation_pct: num(data.variation_pct),
      cours_precedent: num(data.cours_precedent),
      volume: num(data.volume),
      valeur_echangee: num(data.valeur_echangee),
    },
    source,
  };
}

export async function lireHistorique(db: SupabaseClient, code: string, depuis: string | null, seances?: PointCours[]): Promise<Lu<ResumeHistorique | null>> {
  const pts = seances ?? (await lireSeances(db, code));
  const r = resumerHistorique(pts, depuis);
  return { donnees: r, source: { libelle: 'Historique des cours (BRVM)', date: r?.au ?? pts[pts.length - 1]?.date ?? null } };
}

export async function lireIndicateurs(db: SupabaseClient, code: string, seances?: PointCours[]): Promise<Lu<LectureTechniqueIA | null>> {
  const pts = seances ?? (await lireSeances(db, code));
  const t = lireTechnique(pts.slice(-250));
  return { donnees: t, source: { libelle: 'Indicateurs techniques calculés sur les cours', date: t?.seance ?? null } };
}

export async function lireActualites(db: SupabaseClient, code: string): Promise<Lu<Actualite[]>> {
  const jour = aujourdhui();
  const { data } = await db
    .from('brvm_news')
    .select('titre, date_publication, source_label, source')
    .contains('ticker_codes', [code])
    .not('hidden', 'is', true)
    // Jamais une actualité datée dans le futur (erreur de saisie ou de collecte).
    .lte('date_publication', jour)
    .order('date_publication', { ascending: false })
    .limit(15);
  const actus = (data ?? []).map((n) => ({
    titre: tronquer(n.titre, 200) ?? '',
    date: n.date_publication as string,
    source: (n.source_label as string | null) ?? null,
  }));
  return { donnees: actus, source: { libelle: 'Actualités', date: plusRecente(actus.map((a) => a.date), jour) } };
}

export async function lirePublications(db: SupabaseClient, code: string): Promise<Lu<Publication[]>> {
  const jour = aujourdhui();
  const { data } = await db
    .from('publications')
    .select('libelle, date_publication, type_publication')
    .eq('code', code)
    .lte('date_publication', jour)
    .order('date_publication', { ascending: false })
    .limit(20);
  const pubs = (data ?? []).map((p) => ({
    libelle: tronquer(p.libelle, 200) ?? '',
    date: p.date_publication as string,
    type: (p.type_publication as string | null) ?? null,
  }));
  return { donnees: pubs, source: { libelle: 'Publications de la société', date: plusRecente(pubs.map((p) => p.date), jour) } };
}

export async function lireEvenements(db: SupabaseClient, code: string) {
  const jour = aujourdhui();
  const { data } = await db
    .from('market_events')
    .select('event_date, title, event_type, summary, source_type')
    .eq('instrument_code', code)
    .order('event_date', { ascending: false })
    .limit(20);
  const evts = (data ?? []).map((e) => ({
    date: e.event_date as string,
    // Un événement peut être annoncé pour plus tard (assemblée) : il est marqué, pas mêlé au passé.
    a_venir: (e.event_date as string) > jour,
    titre: tronquer(e.title, 200),
    type: e.event_type as string,
    resume: tronquer(e.summary, 300),
  }));
  return { donnees: evts, source: { libelle: 'Événements de marché', date: plusRecente(evts.map((e) => e.date), jour) } };
}

export async function lireDividendes(db: SupabaseClient, code: string): Promise<Lu<LigneDividende[]>> {
  const { data } = await db
    .from('dividends')
    .select('exercice, montant, devise, ex_date, payment_date, base_fiscale')
    .eq('code', code)
    .order('exercice', { ascending: false })
    .limit(60);
  /* Même filtre que lib/agent/outils.ts (audit du 2026-09-08) : sans exercice,
     montant nul ou montant égal à l'année = ligne inexploitable, écartée. */
  const lignes: LigneDividende[] = [];
  const vus = new Set<number>();
  for (const d of data ?? []) {
    const ex = num(d.exercice);
    const m = num(d.montant);
    if (ex == null || m == null || m <= 0 || m === ex || vus.has(ex)) continue;
    vus.add(ex);
    lignes.push({
      exercice: ex,
      montant: m,
      devise: (d.devise as string | null) ?? null,
      ex_date: (d.ex_date as string | null) ?? null,
      payment_date: (d.payment_date as string | null) ?? null,
      base_fiscale: (d.base_fiscale as string | null) ?? null,
    });
  }
  const dates = lignes.flatMap((l) => [l.ex_date, l.payment_date]);
  return {
    donnees: lignes,
    source: {
      libelle: lignes.length ? `Dividendes (dernier exercice ${lignes[0]!.exercice})` : 'Dividendes',
      date: plusRecente(dates, aujourdhui()),
    },
  };
}

export async function lireComptes(db: SupabaseClient, code: string): Promise<Lu<ComptesExercice[]>> {
  const annuel = ['annuel', 'annual'];
  const [is, bs, fu] = await Promise.all([
    db
      .from('income_statements')
      .select('periode, revenu_total, resultat_exploitation, resultat_net')
      .eq('code', code)
      .in('type_periode', annuel)
      .order('periode', { ascending: false })
      .limit(30),
    db
      .from('balance_sheets')
      .select('periode, total_actifs, total_capitaux_propres, dette_long_terme, dette_court_terme, tresorerie_equivalents')
      .eq('code', code)
      .in('type_periode', annuel)
      .order('periode', { ascending: false })
      .limit(30),
    db.from('fundamentals').select('year, revenue, net_income, equity, cash, debt').eq('code', code).order('year', { ascending: false }).limit(30),
  ]);
  const parEx = new Map<number, ComptesExercice>();
  const ligne = (ex: number) => {
    if (!parEx.has(ex)) {
      parEx.set(ex, {
        exercice: ex,
        revenu_total: null,
        resultat_exploitation: null,
        resultat_net: null,
        total_actifs: null,
        capitaux_propres: null,
        dette_financiere: null,
        tresorerie: null,
      });
    }
    return parEx.get(ex)!;
  };
  const exercice = (p: unknown) => {
    const m = /(\d{4})/.exec(String(p ?? ''));
    return m ? Number(m[1]) : null;
  };
  for (const r of is.data ?? []) {
    const ex = exercice(r.periode);
    if (ex == null) continue;
    const l = ligne(ex);
    l.revenu_total = num(r.revenu_total);
    l.resultat_exploitation = num(r.resultat_exploitation);
    l.resultat_net = num(r.resultat_net);
  }
  for (const r of bs.data ?? []) {
    const ex = exercice(r.periode);
    if (ex == null) continue;
    const l = ligne(ex);
    l.total_actifs = num(r.total_actifs);
    l.capitaux_propres = num(r.total_capitaux_propres);
    const lt = num(r.dette_long_terme);
    const ct = num(r.dette_court_terme);
    l.dette_financiere = lt == null && ct == null ? null : (lt ?? 0) + (ct ?? 0);
    l.tresorerie = num(r.tresorerie_equivalents);
  }
  /* `fundamentals` (extraction plus ancienne) ne complète QUE les cases vides :
     il ne contredit jamais les états financiers détaillés. */
  for (const r of fu.data ?? []) {
    const ex = num(r.year);
    if (ex == null) continue;
    const l = ligne(ex);
    l.revenu_total ??= num(r.revenue);
    l.resultat_net ??= num(r.net_income);
    l.capitaux_propres ??= num(r.equity);
    l.tresorerie ??= num(r.cash);
    l.dette_financiere ??= num(r.debt);
  }
  const exercices = [...parEx.values()]
    .filter((e) => Object.entries(e).some(([k, v]) => k !== 'exercice' && v != null))
    .sort((a, b) => b.exercice - a.exercice);
  return {
    donnees: exercices,
    source: { libelle: exercices.length ? `Comptes annuels publiés (exercices ${exercices[exercices.length - 1]!.exercice} à ${exercices[0]!.exercice})` : 'Comptes annuels publiés', date: null },
  };
}

export async function lireSignaux(db: SupabaseClient, code: string) {
  const { data } = await db
    .from('signals_daily')
    .select('date_marche, signal, score_total, score_variation, score_volume, score_rsi, bonus_tendance, penalite_liquidite, confiance, explication')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(20);
  const lignes = (data ?? []).map((s) => ({
    date: s.date_marche as string,
    signal: s.signal === 'BUY' ? 'achat' : s.signal === 'SELL' ? 'vente' : 'attente',
    score_total: num(s.score_total),
    sous_scores: {
      variation: num(s.score_variation),
      volume: num(s.score_volume),
      rsi: num(s.score_rsi),
      bonus_tendance: num(s.bonus_tendance),
      penalite_liquidite: num(s.penalite_liquidite),
    },
    confiance: num(s.confiance),
    explication: tronquer(s.explication, 400),
  }));
  return {
    donnees: {
      signaux: lignes,
      note: 'Signal du moteur WESTBOURSE (score de −1 à +1, seuils ±0,6). Un constat calculé, pas une recommandation.',
    },
    source: { libelle: 'Signaux WESTBOURSE', date: lignes[0]?.date ?? null },
  };
}

export async function lireLiquidite(db: SupabaseClient, code: string): Promise<Lu<{ mesure: MesureLiquidite | null; carnet: CarnetSeance | null; carnets_recents: CarnetSeance[] }>> {
  const [liq, car] = await Promise.all([
    db
      .from('liquidity_daily')
      .select('date_marche, score, classe, presence_pct, valeur_moyenne_30j, spread_pct, spread_roll_pct, spread_source')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('brvm_carnet_daily')
      .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(10),
  ]);
  const l = liq.data;
  const mesure: MesureLiquidite | null = l
    ? {
        date: l.date_marche as string,
        score: num(l.score),
        classe: (l.classe as string | null) ?? null,
        presence_pct: num(l.presence_pct),
        valeur_moyenne_30j: num(l.valeur_moyenne_30j),
        spread_pct: num(l.spread_pct) ?? num(l.spread_roll_pct),
        spread_source: (l.spread_source as string | null) ?? (l.spread_roll_pct != null ? 'roll' : null),
      }
    : null;
  const cote = (auMarche: unknown, cours: unknown, qte: unknown) =>
    auMarche ? { au_marche: true, cours: null, quantite: num(qte) } : num(cours) != null ? { au_marche: false, cours: num(cours), quantite: num(qte) } : null;
  const carnets: CarnetSeance[] = (car.data ?? []).map((c) => ({
    date: c.date_marche as string,
    achat: cote(c.achat_au_marche, c.cours_achat, c.qte_achat),
    vente: cote(c.vente_au_marche, c.cours_vente, c.qte_vente),
  }));
  return {
    donnees: { mesure, carnet: carnets[0] ?? null, carnets_recents: carnets },
    source: { libelle: 'Liquidité et carnet d’ordres (Bulletin officiel de la cote)', date: plusRecente([mesure?.date, carnets[0]?.date]) },
  };
}

export async function lireCombinedAlpha(db: SupabaseClient, code: string) {
  const { data } = await db
    .from('quant_model_scores')
    .select(
      'score_date, combined_alpha_score, value_score, earnings_quality_score, financial_strength_score, dividend_quality_score, price_momentum_score, liquidity_score, classification, confidence_level, rank_global, rank_sector, eligibility_status',
    )
    .eq('security_id', code)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    donnees: data
      ? {
          date: data.score_date,
          score_sur_100: data.combined_alpha_score,
          piliers_sur_100: {
            valorisation: data.value_score,
            qualite_des_resultats: data.earnings_quality_score,
            solidite_financiere: data.financial_strength_score,
            dividende: data.dividend_quality_score,
            dynamique_du_cours: data.price_momentum_score,
            liquidite: data.liquidity_score,
          },
          classification: data.classification,
          confiance: data.confidence_level,
          rang_global: data.rank_global,
          rang_secteur: data.rank_sector,
          eligibilite: data.eligibility_status,
          note: 'Score de modèle quantitatif WESTBOURSE : un classement relatif, pas une recommandation.',
        }
      : null,
    source: { libelle: 'Combined Alpha (modèle quantitatif WESTBOURSE)', date: (data?.score_date as string | undefined) ?? null },
  };
}

export async function lireNotation(db: SupabaseClient, code: string) {
  const { data } = await db.from('brvm_instruments').select('notation_json').eq('code', code).maybeSingle();
  const n = (data?.notation_json as unknown) ?? null;
  const dates: string[] = [];
  JSON.stringify(n ?? {}, (_k, v) => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) dates.push(v);
    return v;
  });
  return { donnees: n, source: { libelle: 'Notation financière', date: plusRecente(dates, aujourdhui()) } };
}

export async function lireAnalysesEtArticles(db: SupabaseClient, code: string) {
  const [h, a] = await Promise.all([
    db
      .from('hebdo_items')
      .select('sens, raison, narratif_md, hebdo_editions!inner(date_edition, statut)')
      .eq('code', code)
      .eq('hebdo_editions.statut', 'publie')
      .limit(10),
    db.from('articles').select('titre, chapo, publie_le, date_fait, slug').eq('code', code).eq('statut', 'publie').order('date_fait', { ascending: false }).limit(5),
  ]);
  const hebdo = (h.data ?? [])
    .map((x) => {
      const ed = (Array.isArray(x.hebdo_editions) ? x.hebdo_editions[0] : x.hebdo_editions) as { date_edition?: string } | null;
      return { date: ed?.date_edition ?? null, sens: x.sens, raison: tronquer(x.raison, 200), narratif: tronquer(x.narratif_md, 500) };
    })
    .sort((p, q) => String(q.date).localeCompare(String(p.date)))
    .slice(0, 5);
  const articles = (a.data ?? []).map((x) => ({ date: x.date_fait as string, titre: tronquer(x.titre, 200), chapo: tronquer(x.chapo, 300), lien: `/actualites/${x.slug}` }));
  return {
    donnees: { analyses_hebdo: hebdo, articles },
    source: { libelle: 'Analyses hebdomadaires et articles WESTBOURSE', date: plusRecente([...hebdo.map((x) => x.date), ...articles.map((x) => x.date)], aujourdhui()) },
  };
}
