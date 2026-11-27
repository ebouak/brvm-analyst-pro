/**
 * Moteur de comparaison et de scoring de similarité historique (pur, sans I/O).
 *
 * Méthode documentée et reproductible (4 composantes avec renormalisation si
 * certaines variables de marché historiques sont indisponibles) :
 *   1. Distance euclidienne normalisée sur (amplitude, durée, vitesse)
 *   2. Corrélation de Pearson sur les trajectoires de drawdown alignées
 *   3. Similarité de forme (MAE des drawdowns sur la fenêtre commune)
 *   4. Proximité des variables de marché (volatilité, largeur, volume, banques)
 *
 * AVERTISSEMENT : une similarité statistique est purement descriptive et ne
 * constitue en aucun cas une prédiction de répétition historique.
 */
import type { EpisodeCrise, PoidsSimilarite, ScoreSimilarite, VariablesMarcheEpisode } from './types.js';

export const POIDS_SIMILARITE_DEFAUT: PoidsSimilarite = {
  euclidienne: 0.30,
  correlation: 0.25,
  formeDrawdown: 0.25,
  variablesMarche: 0.20,
};

export const AVERTISSEMENT_SIMILARITE =
  'Score descriptif de similarité historique ; ne constitue pas une prédiction de répétition.';

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

function interpolerDrawdowns(episode: EpisodeCrise, maxJour: number): number[] {
  const pts = episode.trajectoire_base100;
  if (pts.length === 0) return [];
  const out: number[] = [];
  let cursor = 0;
  for (let j = 0; j <= maxJour; j++) {
    while (cursor + 1 < pts.length && pts[cursor + 1]!.jour_seance <= j) cursor++;
    const p1 = pts[cursor]!;
    const p2 = pts[cursor + 1];
    if (!p2 || p1.jour_seance === j || p2.jour_seance === p1.jour_seance) {
      out.push(p1.drawdown_pct);
    } else {
      const ratio = (j - p1.jour_seance) / (p2.jour_seance - p1.jour_seance);
      out.push(p1.drawdown_pct + ratio * (p2.drawdown_pct - p1.drawdown_pct));
    }
  }
  return out;
}

function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]!; sb += b[i]!; }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  if (denom <= 1e-12) return null;
  return Math.max(-1, Math.min(1, num / denom));
}

function scoreVariablesMarche(
  a?: VariablesMarcheEpisode,
  b?: VariablesMarcheEpisode,
): { score: number | null; ratioVariables: number } {
  if (!a || !b) return { score: null, ratioVariables: 0 };
  const specs: Array<{ key: keyof VariablesMarcheEpisode; echelle: number }> = [
    { key: 'volatilite_moyenne', echelle: 15 },
    { key: 'pct_titres_baisse_moyen', echelle: 30 },
    { key: 'volume_relatif_moyen', echelle: 1.0 },
    { key: 'perf_banques_pct', echelle: 20 },
    { key: 'concentration_sectorielle', echelle: 30 },
  ];
  const diffs: number[] = [];
  for (const s of specs) {
    const va = a[s.key];
    const vb = b[s.key];
    if (va != null && vb != null && Number.isFinite(va) && Number.isFinite(vb)) {
      diffs.push(((va - vb) / s.echelle) ** 2);
    }
  }
  if (diffs.length === 0) return { score: null, ratioVariables: 0 };
  const dist = Math.sqrt(diffs.reduce((x, y) => x + y, 0) / diffs.length);
  return {
    score: round2(clamp(100 * Math.exp(-dist))),
    ratioVariables: diffs.length / specs.length,
  };
}

export function calculerSimilarite(
  courant: EpisodeCrise,
  historique: EpisodeCrise,
  poids: PoidsSimilarite = POIDS_SIMILARITE_DEFAUT,
): ScoreSimilarite {
  // 1. Distance euclidienne normalisée (amplitude, durée baisse, vitesse)
  const vCourant = courant.nb_seances_baisse > 0 ? Math.abs(courant.perte_max_pct) / courant.nb_seances_baisse : 0;
  const vHist = historique.nb_seances_baisse > 0 ? Math.abs(historique.perte_max_pct) / historique.nb_seances_baisse : 0;

  const dAmp = (Math.abs(courant.perte_max_pct) - Math.abs(historique.perte_max_pct)) / 30;
  const dDur = (courant.nb_seances_baisse - historique.nb_seances_baisse) / 200;
  const dVit = (vCourant - vHist) / 0.8;
  const distEuclidienne = Math.sqrt((dAmp * dAmp + dDur * dDur + dVit * dVit) / 3);
  const scoreEuclidien = round2(clamp(100 * Math.exp(-distEuclidienne)));

  // 2 & 3. Trajectoires alignées sur la fenêtre commune
  const maxJC = courant.trajectoire_base100.at(-1)?.jour_seance ?? 0;
  const maxJH = historique.trajectoire_base100.at(-1)?.jour_seance ?? 0;
  const horizonCommun = Math.min(maxJC, maxJH);

  let scoreCorr: number | null = null;
  let scoreForme: number | null = null;
  if (horizonCommun >= 4) {
    const sC = interpolerDrawdowns(courant, horizonCommun);
    const sH = interpolerDrawdowns(historique, horizonCommun);
    const r = pearson(sC, sH);
    if (r !== null) scoreCorr = round2(clamp(((r + 1) / 2) * 100));
    let mae = 0;
    for (let i = 0; i < sC.length; i++) mae += Math.abs(sC[i]! - sH[i]!);
    mae /= sC.length;
    scoreForme = round2(clamp(100 * (1 - mae / 20)));
  }

  // 4. Variables de marché
  const { score: scoreVars, ratioVariables } = scoreVariablesMarche(
    courant.contexte_marche,
    historique.contexte_marche,
  );

  // Renormalisation des poids disponibles
  const compEntries: Array<[keyof PoidsSimilarite, number | null]> = [
    ['euclidienne', scoreEuclidien],
    ['correlation', scoreCorr],
    ['formeDrawdown', scoreForme],
    ['variablesMarche', scoreVars],
  ];
  const disponibles = compEntries.filter(([, v]) => v !== null) as Array<[keyof PoidsSimilarite, number]>;
  const sommePoids = disponibles.reduce((s, [k]) => s + Math.max(0, poids[k]), 0);

  const poids_effectifs: PoidsSimilarite = {
    euclidienne: 0,
    correlation: 0,
    formeDrawdown: 0,
    variablesMarche: 0,
  };

  let scoreTotal = 0;
  if (sommePoids > 0) {
    for (const [k, v] of disponibles) {
      const w = Math.max(0, poids[k]) / sommePoids;
      poids_effectifs[k] = round4(w);
      scoreTotal += w * v;
    }
  }

  // Taux de couverture des dimensions
  const poidsTotal = poids.euclidienne + poids.correlation + poids.formeDrawdown + poids.variablesMarche;
  const couvertureBase =
    ((scoreEuclidien !== null ? poids.euclidienne : 0) +
      (scoreCorr !== null ? poids.correlation : 0) +
      (scoreForme !== null ? poids.formeDrawdown : 0) +
      (scoreVars !== null ? poids.variablesMarche * ratioVariables : 0)) /
    (poidsTotal > 0 ? poidsTotal : 1);

  return {
    score: round2(clamp(scoreTotal)),
    couverture_variables_pct: round2(clamp(couvertureBase * 100)),
    composantes: {
      euclidienne: scoreEuclidien,
      correlation: scoreCorr,
      formeDrawdown: scoreForme,
      variablesMarche: scoreVars,
    },
    poids_effectifs,
    avertissement: AVERTISSEMENT_SIMILARITE,
  };
}

export function classerSimilarites(
  courant: EpisodeCrise,
  historiques: readonly EpisodeCrise[],
  poids: PoidsSimilarite = POIDS_SIMILARITE_DEFAUT,
): Array<{ episode: EpisodeCrise; similarite: ScoreSimilarite }> {
  return historiques
    .filter((h) => !(h.indice_code === courant.indice_code && h.date_sommet === courant.date_sommet))
    .map((episode) => ({ episode, similarite: calculerSimilarite(courant, episode, poids) }))
    .sort((a, b) => b.similarite.score - a.similarite.score);
}
