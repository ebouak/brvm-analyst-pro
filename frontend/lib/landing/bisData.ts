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

export interface Mover {
  code: string;
  nom: string | null;
  cours: number;
  variation: number;
  /** Tracé SVG (44×16) des 20 dernières clôtures, ou null si < 2 points. */
  spark: string | null;
}
export interface Indice { code: string; label: string; valeur: number; variation: number | null }
export interface Plan { code: string; name: string; monthly: number; yearly: number; currency: string }
export interface EtatMarche {
  valeurEchangee: number | null;   // somme de valeur_echangee (FCFA)
  titresEchanges: number | null;   // somme de volume (titres)
  transactions: number | null;
  sentimentScore: number;          // hausses / (hausses + baisses) × 100 — même méthode que le dashboard
  sentimentDelta: number | null;   // écart contre la veille, en points
}
export interface TopNote { code: string; nom: string | null; score: number | null; signal: string | null; grade: string | null }

export interface LandingBisData {
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
    etat: { valeurEchangee: null, titresEchanges: null, transactions: null, sentimentScore: 50, sentimentDelta: null },
  };

  const [dateMarche, plansRes, slidesRes, collecteRes] = await Promise.all([
    getLastMarketDate(db),
    db.from('subscription_plans').select('code, name, price_monthly, price_yearly, currency').order('price_monthly'),
    db.from('landing_slides').select('id, kind, title, subtitle, cta_label, link_url, image_path, sponsor_name, starts_at, ends_at, is_active, position').order('position'),
    db.from('v_fraicheur_cours').select('derniere_collecte_intraday').maybeSingle(),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const slides = composeSlides(PERMANENT_SLIDES, (slidesRes.data ?? []) as LandingSlideRow[], supabaseUrl);
  const plans: Plan[] = (plansRes.data ?? []).map((p) => ({
    code: String(p.code), name: String(p.name), monthly: Number(p.price_monthly ?? 0), yearly: Number(p.price_yearly ?? 0), currency: String(p.currency ?? 'XOF'),
  }));
  const derniereCollecte = (collecteRes.data?.derniere_collecte_intraday as string | null) ?? null;
  if (!dateMarche) return { ...vide, plans, slides, derniereCollecte };

  const [rowsRes, prevRes, idxRes, instRes, sigRes] = await Promise.all([
    db.from('brvm_actions_daily').select('code, cours_jour, variation_pct, volume, valeur_echangee, nb_transactions').eq('date_marche', dateMarche),
    db.from('brvm_actions_daily').select('date_marche').lt('date_marche', dateMarche).order('date_marche', { ascending: false }).limit(1).maybeSingle(),
    db.from('brvm_indices_daily').select('code, valeur, variation_pct').eq('date_marche', dateMarche),
    db.from('brvm_instruments').select('code, designation'),
    db.from('signals_daily').select('code, score_total, signal, confiance').eq('date_marche', dateMarche).order('score_total', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const noms = new Map<string, string | null>((instRes.data ?? []).map((i) => [String(i.code), (i.designation as string | null) ?? null]));
  const rows = (rowsRes.data ?? [])
    .filter((r) => r.cours_jour != null)
    .map((r) => ({ code: String(r.code), cours: Number(r.cours_jour), variation: Number(r.variation_pct ?? 0), volume: r.volume == null ? null : Number(r.volume), valeur: r.valeur_echangee == null ? null : Number(r.valeur_echangee), tx: r.nb_transactions == null ? null : Number(r.nb_transactions) }));
  const hausses = rows.filter((r) => r.variation > 0).length;
  const baisses = rows.filter((r) => r.variation < 0).length;
  const parVar = [...rows].sort((a, b) => b.variation - a.variation);
  const top = parVar.filter((r) => r.variation > 0).slice(0, 3);
  const bottom = parVar.filter((r) => r.variation < 0).slice(-3).reverse();

  // Sparklines réelles : 20 dernières clôtures des 6 codes du palmarès.
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
  const toMover = (r: { code: string; cours: number; variation: number }): Mover => ({
    code: r.code, nom: noms.get(r.code) ?? null, cours: r.cours, variation: r.variation, spark: sparks.get(r.code) ?? null,
  });

  const indices: Indice[] = (idxRes.data ?? [])
    .filter((i) => i.valeur != null)
    .map((i) => ({ code: String(i.code), label: LABELS[String(i.code)] ?? String(i.code), valeur: Number(i.valeur), variation: i.variation_pct == null ? null : Number(i.variation_pct) }));
  const brvmC = indices.find((i) => i.code === 'BRVMC') ?? null;

  // État du marché : sommes réelles (null si aucune ligne ne porte la donnée) et
  // sentiment vs veille, même méthode que le dashboard.
  const somme = (f: (r: typeof rows[number]) => number | null) => rows.some((r) => f(r) != null) ? rows.reduce((a, r) => a + (f(r) ?? 0), 0) : null;
  const sentimentScore = hausses + baisses > 0 ? (hausses / (hausses + baisses)) * 100 : 50;
  let sentimentDelta: number | null = null;
  const prevDate = (prevRes.data?.date_marche as string | undefined) ?? null;
  if (prevDate) {
    const { data: prev } = await db.from('brvm_actions_daily').select('variation_pct').eq('date_marche', prevDate);
    let h = 0, b = 0;
    for (const r of prev ?? []) { const v = Number(r.variation_pct ?? 0); if (v > 0) h++; else if (v < 0) b++; }
    if (h + b > 0) sentimentDelta = sentimentScore - (h / (h + b)) * 100;
  }
  const etat: EtatMarche = { valeurEchangee: somme((r) => r.valeur), titresEchanges: somme((r) => r.volume), transactions: somme((r) => r.tx), sentimentScore, sentimentDelta };

  const sig = sigRes.data;
  const topNote: TopNote | null = sig
    ? { code: String(sig.code), nom: noms.get(String(sig.code)) ?? null, score: sig.score_total == null ? null : Number(sig.score_total), signal: (sig.signal as string | null) ?? null, grade: scoreToRating(sig.score_total == null ? null : Number(sig.score_total), sig.confiance == null ? null : Number(sig.confiance)).note }
    : null;

  return {
    dateMarche, nbActions: rows.length, hausses, baisses, inchangees: rows.length - hausses - baisses, brvmC,
    topHausses: top.map(toMover), topBaisses: bottom.map(toMover), indices, plans, slides, topNote, derniereCollecte, etat,
  };
}

export const getLandingBisData = unstable_cache(load, ['landing-bis-data'], { revalidate: 300 });
