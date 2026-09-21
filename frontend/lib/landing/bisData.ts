/**
 * Données de la landing (version claire, « bis ») — une seule fonction, mise
 * en cache 5 min. Tout vient de Supabase à la clé anon : aucun chiffre n'est
 * saisi ici. La fraîcheur (`computeFreshness`) est calculée AU RENDU par la
 * page, pas ici — un âge figé dans le cache serait faux dès la 2e visite.
 */
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { getLastMarketDate } from '@/lib/marketDate';
import { sparklinePath } from '@/lib/landing/sparkline';
import { composeSlides, PERMANENT_SLIDES, type LandingSlideRow, type Slide } from '@/lib/landing/slides';
import { scoreToRating } from '@/lib/rating';
import { computeSectorVariations, type SectorVariation } from '@/lib/landing/sectors';
import brvmSectors from '@/lib/brvmSectors.json';
import brvmLogos from '@/lib/brvmLogos.json';
import { getVideoSeance, type VideoSeance } from '@/lib/landing/videoSeance';
import { getLatestDiagnostic, type LatestDiagnostic } from '@/lib/landing/latestDiagnostic';
import type { SignalDaily } from '@/lib/types';
import { getSgiDirectory, getSgiFrais } from '@/lib/sgi-frais/queries';
import { PAYS } from '@/lib/sgi-frais/directory';

export interface Mover {
  code: string;
  nom: string | null;
  logo: string | null;
  cours: number;
  variation: number;
  volume: number | null;
  valeur: number | null;
  /** Tracé SVG (44×16) des 20 dernières clôtures, ou null si < 2 points. */
  spark: string | null;
}
export interface Indice { code: string; label: string; valeur: number; variation: number | null; veille: number | null }
export interface Point { d: string; v: number }
export interface Plan { code: string; name: string; monthly: number; yearly: number; currency: string }
export interface EtatMarche {
  valeurEchangee: number | null;   // somme de valeur_echangee (FCFA)
  titresEchanges: number | null;   // somme de volume (titres)
  transactions: number | null;
  /** Écarts contre la veille, en % (null si l'une des deux sommes manque). */
  valeurVsVeille: number | null;
  titresVsVeille: number | null;
  transactionsVsVeille: number | null;
  sentimentScore: number;          // hausses / (hausses + baisses) × 100 — même méthode que le dashboard
  sentimentDelta: number | null;   // écart contre la veille, en points
}
export interface TopNote { code: string; nom: string | null; score: number | null; signal: string | null; grade: string | null }

export interface SgiCompteurs { nb: number; nbGrilles: number; pays: string[] }

export interface LandingBisData {
  /** Compteurs réels du comparateur SGI (annuaire + grilles tarifaires en base). */
  sgi: SgiCompteurs;
  dateMarche: string | null;
  nbActions: number;
  hausses: number;
  baisses: number;
  inchangees: number;
  brvmC: Indice | null;
  topHausses: Mover[];
  topBaisses: Mover[];
  indices: Indice[];
  plans: Plan[];
  slides: Slide[];
  topNote: TopNote | null;
  derniereCollecte: string | null;
  etat: EtatMarche;
  /** Clôtures BRVM Composite, ~250 dernières séances, chronologiques. */
  brvmCSerie: Point[];
  secteurs: SectorVariation[];
  /** Valeur la plus échangée (FCFA) de la séance, ou null si aucune valeur renseignée. */
  plusEchangee: { code: string; valeur: number } | null;
  /** Vidéo de séance publiée (bucket seance-video), ou null — le composant disparaît alors. */
  videoSeance: VideoSeance | null;
  /** Signal le mieux noté de la séance, avec ses sous-scores (RatingSpotlight). */
  spotlightSignal: (SignalDaily & { code: string }) | null;
  /** Dernier diagnostic IA réellement généré, ou null. */
  latestDiagnostic: LatestDiagnostic | null;
}

const LABELS: Record<string, string> = {
  BRVMC: 'BRVM Composite', BRVM30: 'BRVM 30', BRVMPRES: 'BRVM Prestige', BRVMPRIN: 'BRVM Principal',
  BRVMCBASE: 'Consommation de base', BRVMCDISC: 'Consommation discrétionnaire', BRVMENER: 'Énergie',
  BRVMINDU: 'Industriels', BRVMFINS: 'Services financiers', BRVMSPUB: 'Services publics', BRVMTELE: 'Télécoms',
};

async function load(): Promise<LandingBisData> {
  const db = createPublicClient();
  const vide: LandingBisData = {
    dateMarche: null, nbActions: 0, hausses: 0, baisses: 0, inchangees: 0, brvmC: null,
    topHausses: [], topBaisses: [], indices: [], plans: [], slides: [...PERMANENT_SLIDES], topNote: null, derniereCollecte: null,
    etat: { valeurEchangee: null, titresEchanges: null, transactions: null, valeurVsVeille: null, titresVsVeille: null, transactionsVsVeille: null, sentimentScore: 50, sentimentDelta: null },
    brvmCSerie: [],
    secteurs: [],
    plusEchangee: null,
    videoSeance: null,
    spotlightSignal: null,
    latestDiagnostic: null,
    sgi: { nb: 0, nbGrilles: 0, pays: [] },
  };

  const [dateMarche, plansRes, slidesRes, collecteRes, videoSeance, latestDiagnostic, sgiDir, sgiFrais] = await Promise.all([
    getLastMarketDate(db),
    db.from('subscription_plans').select('code, name, price_monthly, price_yearly, currency').order('price_monthly'),
    db.from('landing_slides').select('id, kind, title, subtitle, cta_label, link_url, image_path, sponsor_name, starts_at, ends_at, is_active, position').order('position'),
    db.from('v_fraicheur_cours').select('derniere_collecte_intraday').maybeSingle(),
    getVideoSeance().catch(() => null),
    getLatestDiagnostic().catch(() => null),
    getSgiDirectory().catch(() => []),
    getSgiFrais().catch(() => []),
  ]);
  const sgi: SgiCompteurs = { nb: sgiDir.length, nbGrilles: sgiFrais.length, pays: [...new Set(sgiDir.map((x) => PAYS[x.pays]?.nom).filter((n): n is string => !!n))] };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const slides = composeSlides(PERMANENT_SLIDES, (slidesRes.data ?? []) as LandingSlideRow[], supabaseUrl);
  const plans: Plan[] = (plansRes.data ?? []).map((p) => ({
    code: String(p.code), name: String(p.name), monthly: Number(p.price_monthly ?? 0), yearly: Number(p.price_yearly ?? 0), currency: String(p.currency ?? 'XOF'),
  }));
  const derniereCollecte = (collecteRes.data?.derniere_collecte_intraday as string | null) ?? null;
  if (!dateMarche) return { ...vide, plans, slides, derniereCollecte, videoSeance, latestDiagnostic, sgi };


  const [rowsRes, prevRes, idxRes, instRes, serieRes, sigRes] = await Promise.all([
    db.from('brvm_actions_daily').select('code, cours_jour, variation_pct, volume, valeur_echangee, nb_transactions').eq('date_marche', dateMarche),
    db.from('brvm_actions_daily').select('date_marche').lt('date_marche', dateMarche).order('date_marche', { ascending: false }).limit(1).maybeSingle(),
    db.from('brvm_indices_daily').select('code, valeur, variation_pct, valeur_precedente').eq('date_marche', dateMarche),
    db.from('brvm_instruments').select('code, designation, shares'),
    db.from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC').lte('date_marche', dateMarche).order('date_marche', { ascending: false }).limit(250),
    db.from('signals_daily').select('*').eq('date_marche', dateMarche).order('score_total', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const noms = new Map<string, string | null>((instRes.data ?? []).map((i) => [String(i.code), (i.designation as string | null) ?? null]));
  const rows = (rowsRes.data ?? [])
    .filter((r) => r.cours_jour != null)
    .map((r) => ({ code: String(r.code), cours: Number(r.cours_jour), variation: Number(r.variation_pct ?? 0), volume: r.volume == null ? null : Number(r.volume), valeur: r.valeur_echangee == null ? null : Number(r.valeur_echangee), tx: r.nb_transactions == null ? null : Number(r.nb_transactions) }));
  const hausses = rows.filter((r) => r.variation > 0).length;
  const baisses = rows.filter((r) => r.variation < 0).length;
  const parVar = [...rows].sort((a, b) => b.variation - a.variation);
  const top = parVar.filter((r) => r.variation > 0).slice(0, 5);
  const bottom = parVar.filter((r) => r.variation < 0).slice(-5).reverse();

  // Sparklines réelles : 20 dernières clôtures des codes du palmarès (≤ 10).
  const codes = [...top, ...bottom].map((r) => r.code);
  const sparks = new Map<string, string | null>();
  if (codes.length) {
    const { data: hist } = await db
      .from('brvm_actions_daily').select('code, date_marche, cours_jour')
      .in('code', codes).lte('date_marche', dateMarche).order('date_marche', { ascending: false }).limit(20 * codes.length);
    for (const c of codes) {
      const serie = (hist ?? []).filter((h) => h.code === c).slice(0, 20).reverse().map((h) => Number(h.cours_jour)).filter((v) => v > 0);
      sparks.set(c, sparklinePath(serie, 44, 16)?.line ?? null);
    }
  }
  const toMover = (r: { code: string; cours: number; variation: number; volume: number | null; valeur: number | null }): Mover => ({
    code: r.code, nom: noms.get(r.code) ?? null, logo: (brvmLogos as Record<string, string>)[r.code] ?? null, cours: r.cours, variation: r.variation, volume: r.volume, valeur: r.valeur, spark: sparks.get(r.code) ?? null,
  });

  const indices: Indice[] = (idxRes.data ?? [])
    .filter((i) => i.valeur != null)
    .map((i) => ({ code: String(i.code), label: LABELS[String(i.code)] ?? String(i.code), valeur: Number(i.valeur), variation: i.variation_pct == null ? null : Number(i.variation_pct), veille: i.valeur_precedente == null ? null : Number(i.valeur_precedente) }));
  const brvmC = indices.find((i) => i.code === 'BRVMC') ?? null;

  // État du marché : sommes réelles (null si aucune ligne ne porte la donnée) et
  // sentiment vs veille, même méthode que le dashboard.
  const somme = (f: (r: typeof rows[number]) => number | null) => rows.some((r) => f(r) != null) ? rows.reduce((a, r) => a + (f(r) ?? 0), 0) : null;
  const sentimentScore = hausses + baisses > 0 ? (hausses / (hausses + baisses)) * 100 : 50;
  let sentimentDelta: number | null = null;
  const prevDate = (prevRes.data?.date_marche as string | undefined) ?? null;
  let veilleValeur: number | null = null, veilleTitres: number | null = null, veilleTx: number | null = null;
  if (prevDate) {
    const { data: prev } = await db.from('brvm_actions_daily').select('variation_pct, volume, valeur_echangee, nb_transactions').eq('date_marche', prevDate);
    let h = 0, b = 0;
    const pr = (prev ?? []).map((r) => ({ v: Number(r.variation_pct ?? 0), volume: r.volume == null ? null : Number(r.volume), valeur: r.valeur_echangee == null ? null : Number(r.valeur_echangee), tx: r.nb_transactions == null ? null : Number(r.nb_transactions) }));
    for (const r of pr) { if (r.v > 0) h++; else if (r.v < 0) b++; }
    if (h + b > 0) sentimentDelta = sentimentScore - (h / (h + b)) * 100;
    const sp = (f: (r: typeof pr[number]) => number | null) => pr.some((r) => f(r) != null) ? pr.reduce((a, r) => a + (f(r) ?? 0), 0) : null;
    veilleValeur = sp((r) => r.valeur); veilleTitres = sp((r) => r.volume); veilleTx = sp((r) => r.tx);
  }
  const vs = (a: number | null, b: number | null) => a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null;
  const valeurEchangee = somme((r) => r.valeur), titresEchanges = somme((r) => r.volume), transactions = somme((r) => r.tx);
  const etat: EtatMarche = {
    valeurEchangee, titresEchanges, transactions,
    valeurVsVeille: vs(valeurEchangee, veilleValeur), titresVsVeille: vs(titresEchanges, veilleTitres), transactionsVsVeille: vs(transactions, veilleTx),
    sentimentScore, sentimentDelta,
  };

  // Série BRVM Composite (chronologique) et variations sectorielles pondérées
  // par la capitalisation (brvmSectors.json + brvm_instruments.shares).
  const brvmCSerie: Point[] = (serieRes.data ?? []).filter((r) => r.valeur != null).map((r) => ({ d: String(r.date_marche), v: Number(r.valeur) })).reverse();
  const sharesByCode = new Map<string, number | null>((instRes.data ?? []).map((i) => [String(i.code), i.shares == null ? null : Number(i.shares)]));
  const maxVal = rows.filter((r) => r.valeur != null && r.valeur > 0).sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0))[0];
  const plusEchangee = maxVal ? { code: maxVal.code, valeur: maxVal.valeur as number } : null;
  const secteurs = computeSectorVariations(
    rows.map((r) => ({ code: r.code, variation_pct: r.variation, cours_jour: r.cours, shares: sharesByCode.get(r.code) ?? null })),
    brvmSectors as Record<string, string>,
  );

  const sig = sigRes.data as (SignalDaily & { code: string }) | null;
  const spotlightSignal = sig ?? null;
  const topNote: TopNote | null = sig
    ? { code: String(sig.code), nom: noms.get(String(sig.code)) ?? null, score: sig.score_total == null ? null : Number(sig.score_total), signal: (sig.signal as string | null) ?? null, grade: scoreToRating(sig.score_total == null ? null : Number(sig.score_total), sig.confiance == null ? null : Number(sig.confiance)).note }
    : null;

  return {
    dateMarche, nbActions: rows.length, hausses, baisses, inchangees: rows.length - hausses - baisses, brvmC,
    topHausses: top.map(toMover), topBaisses: bottom.map(toMover), indices, plans, slides, topNote, derniereCollecte, etat, brvmCSerie, secteurs, plusEchangee, videoSeance, spotlightSignal, latestDiagnostic, sgi,
  };
}

export const getLandingBisData = unstable_cache(load, ['landing-bis-data'], { revalidate: 300 });
