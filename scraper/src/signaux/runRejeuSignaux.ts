import { appendFileSync } from 'node:fs';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { computeScore } from '../scoring/score.js';
import { evaluerSignaux, formaterRapport, HORIZONS_DEFAUT, type PointCours, type PointSignal } from './evaluation.js';
import { ancienScore, ecartHautBas, entreeSeance, spearman, variantesScore, type LigneSeance } from './rejeu.js';

/**
 * Rejeu du scoring, LECTURE SEULE : recalcule chaque séance avec la formule
 * d'avant et celle d'après le 2026-11-13, passe les deux séries au même banc,
 * et mesure la corrélation de rang de chaque composante avec le rendement
 * relatif au marché (constat A3 : garder les composantes dont le signe est
 * prouvé). Rien n'est écrit en base ; aucun seuil n'est changé ici.
 */
// Période rejouée : par défaut 2024 → aujourd'hui. REJEU_DEBUT / REJEU_FIN (AAAA-MM-JJ)
// permettent un test HORS ÉCHANTILLON sur l'historique antérieur (2008-2023), que
// la formule n'a jamais vu. Les cours restent lus après REJEU_FIN, pour que les
// horizons de 5 à 60 séances des derniers signaux soient mesurables.
const DEBUT_SCORES = process.env.REJEU_DEBUT ?? '2024-01-01';
const FIN_SCORES = process.env.REJEU_FIN ?? '9999-12-31';
// Un an avant le premier score : de quoi calculer RSI, MACD et moyennes.
const DEBUT_HISTO = `${Number(DEBUT_SCORES.slice(0, 4)) - 1}${DEBUT_SCORES.slice(4)}`;
const HORIZONS_CORR = [5, 10, 20];

export async function runRejeuSignaux(): Promise<{ rapport: string }> {
  const sb = getSupabase();
  const TAILLE = 1000;
  async function toutLire<T>(construire: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    const lignes: T[] = [];
    for (let a = 0; ; a += TAILLE) {
      const { data, error } = await construire(a, a + TAILLE - 1);
      if (error) throw new Error(`lecture : ${error.message}`);
      const lot = (data ?? []) as T[];
      lignes.push(...lot);
      if (lot.length < TAILLE) break;
    }
    return lignes;
  }

  const brut = await toutLire<{ code: string; date_marche: string; cours_jour: number | null; variation_pct: number | null; volume: number | null }>((a, b) =>
    sb.from('brvm_actions_daily').select('code, date_marche, cours_jour, variation_pct, volume')
      .gte('date_marche', DEBUT_HISTO).gt('cours_jour', 0)
      .order('code', { ascending: true }).order('date_marche', { ascending: true })
      .range(a, b));
  const liq = await toutLire<{ code: string; date_marche: string; score: number | null }>((a, b) =>
    sb.from('liquidity_daily').select('code, date_marche, score').order('code').order('date_marche').range(a, b));
  const liquidite = new Map(liq.map((l) => [`${l.code}|${l.date_marche}`, l.score]));

  const parCode = new Map<string, LigneSeance[]>();
  for (const r of brut) {
    const l = parCode.get(r.code) ?? [];
    l.push({ code: r.code, date: r.date_marche, cours: Number(r.cours_jour), variation_pct: r.variation_pct == null ? null : Number(r.variation_pct), volume: r.volume == null ? null : Number(r.volume) });
    parCode.set(r.code, l);
  }

  const avant: PointSignal[] = [];
  const apres: PointSignal[] = [];
  const comp: { code: string; date: string; pos: number; variation: number; volume: number; macd: number; rsi: number; tendance: number; nouveau: number; ancien: number }[] = [];
  for (const [, histo] of parCode) {
    for (let i = 0; i < histo.length; i++) {
      if (histo[i]!.date < DEBUT_SCORES || histo[i]!.date > FIN_SCORES) continue;
      const r = computeScore(entreeSeance(histo, i, liquidite.get(`${histo[i]!.code}|${histo[i]!.date}`) ?? null));
      if (r.inputs.incomplet) continue;
      const ancien = ancienScore(r);
      avant.push({ code: r.code, date: histo[i]!.date, score: ancien });
      apres.push({ code: r.code, date: histo[i]!.date, score: r.score_total });
      comp.push({
        code: r.code, date: histo[i]!.date, pos: i,
        variation: r.score_variation ?? 0, volume: r.score_volume ?? 0, macd: r.score_macd ?? 0,
        rsi: (r.score_rsi ?? 0) * r.inputs.rsi_regime_weight, tendance: r.bonus_tendance, nouveau: r.score_total, ancien,
      });
    }
  }
  if (!apres.length) throw new Error('aucune séance rejouable');

  const cours: PointCours[] = brut.filter((r) => r.date_marche >= DEBUT_SCORES).map((r) => ({ code: r.code, date: r.date_marche, cours: Number(r.cours_jour) }));
  const debut = apres.map((s) => s.date).sort()[0]!;
  const fin = apres.map((s) => s.date).sort().at(-1)!;
  const rapportAvant = formaterRapport(evaluerSignaux(avant, cours, { horizons: HORIZONS_DEFAUT }), { debut, fin, nSignaux: avant.length });
  const rapportApres = formaterRapport(evaluerSignaux(apres, cours, { horizons: HORIZONS_DEFAUT }), { debut, fin, nSignaux: apres.length });
  // Variante « retrait » ramenée sur l'échelle [−1 ; 1] (RSI et tendance pèsent au plus 0,4),
  // pour la juger au même banc et aux mêmes tranches que la formule en production.
  const retrait: PointSignal[] = comp.map((c) => ({ code: c.code, date: c.date, score: Math.max(-1, Math.min(1, variantesScore(c).retrait / 0.4)) }));
  const rapportRetrait = formaterRapport(evaluerSignaux(retrait, cours, { horizons: HORIZONS_DEFAUT }), { debut, fin, nSignaux: retrait.length });

  // Corrélation de rang composante → rendement relatif au marché (moyenne équipondérée du jour).
  const lignesCorr: string[] = [];
  for (const h of HORIZONS_CORR) {
    const obs: { c: (typeof comp)[number]; r: number }[] = [];
    for (const c of comp) {
      const histo = parCode.get(c.code)!;
      const arrivee = histo[c.pos + h];
      if (arrivee) obs.push({ c, r: arrivee.cours / histo[c.pos]!.cours - 1 });
    }
    const moyenneDuJour = new Map<string, { s: number; n: number }>();
    for (const o of obs) { const m = moyenneDuJour.get(o.c.date) ?? { s: 0, n: 0 }; m.s += o.r; m.n++; moyenneDuJour.set(o.c.date, m); }
    const rel = obs.map((o) => o.r - moyenneDuJour.get(o.c.date)!.s / moyenneDuJour.get(o.c.date)!.n);
    const f = (k: keyof (typeof comp)[number]) => { const v = spearman(obs.map((o) => Number(o.c[k])), rel); return v == null ? '—' : v.toFixed(3).replace('.', ','); };
    lignesCorr.push(`| ${h} séances | ${obs.length} | ${f('variation')} | ${f('volume')} | ${f('macd')} | ${f('rsi')} | ${f('tendance')} | ${f('ancien')} | ${f('nouveau')} |`);
  }

  // Variantes de composition : écart haut − bas, par période, sur jours non chevauchants.
  const PERIODES: [string, string, string][] = [['2024-2025', '2024-01-01', '2025-12-31'], ['2026', '2026-01-01', '2099-12-31']];
  const lignesVar: string[] = [];
  for (const h of [5, 20]) {
    for (const [nom, d0, d1] of PERIODES) {
      const obs: { c: (typeof comp)[number]; r: number }[] = [];
      for (const c of comp) {
        if (c.date < d0 || c.date > d1) continue;
        const histo = parCode.get(c.code)!;
        const arrivee = histo[c.pos + h];
        if (arrivee) obs.push({ c, r: arrivee.cours / histo[c.pos]!.cours - 1 });
      }
      const moy = new Map<string, { s: number; n: number }>();
      for (const o of obs) { const m = moy.get(o.c.date) ?? { s: 0, n: 0 }; m.s += o.r; m.n++; moy.set(o.c.date, m); }
      const cellule = (cle: 'actuel' | 'retrait' | 'inversion') => {
        const r = ecartHautBas(obs.map((o) => ({ date: o.c.date, score: variantesScore(o.c)[cle], rel: o.r - moy.get(o.c.date)!.s / moy.get(o.c.date)!.n })), h);
        if (!r) return '—';
        const t = r.moyenne / r.erreur;
        const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2).replace('.', ',')} %`;
        return `${pct(r.moyenne)} (t = ${t.toFixed(1).replace('.', ',')}, ${r.jours} j.)`;
      };
      lignesVar.push(`| ${h} séances | ${nom} | ${cellule('actuel')} | ${cellule('retrait')} | ${cellule('inversion')} |`);
    }
  }

  const rapport = [
    `# Rejeu du scoring, ${debut} → ${fin}`,
    '',
    `${apres.length} séances rejouées (titre × jour, hors séances neutralisées pour données incomplètes).`,
    '',
    '## Avant (formule jusqu’au 2026-11-13)',
    rapportAvant,
    '',
    '## Après (volume corrigé, liquidité en atténuation)',
    rapportApres,
    '',
    '## Variante « retrait » (RSI + tendance, ramenée sur [−1 ; 1])',
    rapportRetrait,
    '',
    '## Corrélation de rang avec le rendement relatif au marché',
    'Positif : la composante annonce une surperformance. Les observations se chevauchent (une par titre et par jour) : ces corrélations orientent, elles ne prouvent rien seules.',
    '',
    '| Horizon | Observations | Variation | Volume | MACD | RSI (× régime) | Tendance | Total avant | Total après |',
    '|---|---|---|---|---|---|---|---|---|',
    ...lignesCorr,
    '',
    '## Variantes de composition : écart de rendement entre les 20 % mieux notés et les 20 % moins bien notés',
    'Rendement relatif au marché ; un jour sur h (fenêtres sans chevauchement). Positif : le score classe bien. |t| ≥ 2 : écart significatif.',
    '',
    '| Horizon | Période | Actuel | Retrait (RSI + tendance) | Inversion du momentum |',
    '|---|---|---|---|---|',
    ...lignesVar,
  ].join('\n');

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${rapport}\n`);
  logger.info({ seances: apres.length, debut, fin }, 'eval:signaux:rejeu terminé');
  return { rapport };
}
