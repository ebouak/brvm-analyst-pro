// COPIE de scraper/src/stress/pure/stressIndex.ts — NE PAS DIVERGER (vérifié par scraper/tests/stressCopie.test.ts).
/**
 * Calcul pur et contemporain du BRVM Market Stress Index (0-100) et des 4
 * observables factuels de séance (Phase 4 — WESTBOURSE Stress Monitor).
 *
 * Règles impératives :
 *   - Zéro look-ahead : à la date t, seules les observations <= t sont lues.
 *   - Zéro signal d'achat/vente : mesure descriptive de la tension courante.
 *   - Renormalisation transparente des poids si une composante est absente.
 *
 * Copié vers `frontend/lib/stress/stressIndex.ts`
 * (parité vérifiée par `scraper/tests/stressCopie.test.ts`).
 */
import { calculerDrawdowns } from './drawdowns';
import type { PointIndice } from './types';
import {
  POIDS_NOMINAUX_STRESS,
  type ActionSeanceStressInput,
  type CleComposanteStress,
  type DetailComposanteStress,
  type MapComposantesStress,
  type NervositeStressInput,
  type RegimeStress,
  type StressDailyRow,
} from './stressIndexTypes';

const CLES: readonly CleComposanteStress[] = [
  'drawdown_composite',
  'largeur_baissiere',
  'volatilite_brvmv',
  'diffusion_sectorielle',
  'pression_volumes',
  'momentum_court_terme',
];

const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;
const clamp100 = (x: number) => Math.min(100, Math.max(0, round2(x)));

export function classifierRegimeStress(score: number): RegimeStress {
  if (score >= 75) return 'tension_extreme';
  if (score >= 50) return 'tension_elevee';
  if (score >= 25) return 'tension_moderee';
  return 'faible_tension';
}

function mediane(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Calcule la série historique quotidienne de `StressDailyRow` sur les dernières
 * `maxSeances` séances disponibles de `serieComposite`.
 */
export function calculerSerieStressIndex(
  serieComposite: readonly PointIndice[],
  actionsDaily: readonly ActionSeanceStressInput[],
  nervositeDaily: readonly NervositeStressInput[],
  opts: { maxSeances?: number } = {},
): StressDailyRow[] {
  const ddSerie = calculerDrawdowns(serieComposite);
  if (ddSerie.length === 0) return [];

  const maxSeances = opts.maxSeances ?? 320;
  const idxDebut = Math.max(0, ddSerie.length - maxSeances);

  // Indexer nervosité par date
  const nervMap = new Map<string, NervositeStressInput>();
  for (const n of nervositeDaily) {
    nervMap.set(n.date_marche.slice(0, 10), n);
  }

  // Indexer actions par date (statistiques journalières + cours par code/secteur)
  const parDateActions = new Map<
    string,
    {
      nbActifs: number;
      nbHausses: number;
      nbBaisses: number;
      volTotal: number;
      volBaisse: number;
      parCode: Map<string, { cours: number; secteur: string; cap: number }>;
    }
  >();

  for (const a of actionsDaily) {
    if (!(a.cours_jour > 0)) continue;
    const d = a.date_marche.slice(0, 10);
    let bucket = parDateActions.get(d);
    if (!bucket) {
      bucket = {
        nbActifs: 0,
        nbHausses: 0,
        nbBaisses: 0,
        volTotal: 0,
        volBaisse: 0,
        parCode: new Map(),
      };
      parDateActions.set(d, bucket);
    }
    if (a.variation_pct != null) {
      bucket.nbActifs++;
      if (a.variation_pct > 0) bucket.nbHausses++;
      else if (a.variation_pct < 0) bucket.nbBaisses++;
    }
    const vol = a.volume != null && a.volume > 0 ? a.volume : 0;
    bucket.volTotal += vol;
    if ((a.variation_pct ?? 0) < 0) bucket.volBaisse += vol;
    bucket.parCode.set(a.code, {
      cours: a.cours_jour,
      secteur: a.secteur || 'Autre',
      cap: a.capitalisation && a.capitalisation > 0 ? a.capitalisation : 1,
    });
  }

  // Pré-calculer volatilité réalisée 20j sur BRVMC en repli si BRVM-V absent à une date ancienne
  const volBrvmc20: Array<number | null> = ddSerie.map((_, t) => {
    if (t < 20) return null;
    const rs: number[] = [];
    for (let k = t - 19; k <= t; k++) {
      rs.push(ddSerie[k]!.valeur / ddSerie[k - 1]!.valeur - 1);
    }
    const m = rs.reduce((s, x) => s + x, 0) / rs.length;
    const v = rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1);
    return round2(Math.sqrt(v * 252) * 100);
  });

  const brutsRows: StressDailyRow[] = [];

  for (let t = idxDebut; t < ddSerie.length; t++) {
    const pt = ddSerie[t]!;
    const d = pt.date_marche;

    // 1. Drawdown du Composite (0 % -> 0, -35 % -> 100)
    const ddVal = pt.drawdown_pct;
    const scoreDd = clamp100((-ddVal / 35) * 100);

    // 2. Largeur baissière 5 séances & observable largeur hausses 5 séances
    let sumPctBaisses = 0;
    let sumPctHausses = 0;
    let nJoursBreadth = 0;
    let sumVolBaisseRatio = 0;
    let nJoursVol = 0;

    for (let k = Math.max(0, t - 4); k <= t; k++) {
      const bk = parDateActions.get(ddSerie[k]!.date_marche);
      if (bk && bk.nbActifs >= 10) {
        sumPctBaisses += (100 * bk.nbBaisses) / bk.nbActifs;
        sumPctHausses += (100 * bk.nbHausses) / bk.nbActifs;
        nJoursBreadth++;
      }
      if (bk && bk.volTotal > 0 && bk.nbActifs >= 10) {
        sumVolBaisseRatio += (100 * bk.volBaisse) / bk.volTotal;
        nJoursVol++;
      }
    }

    const largeurBaissiere5j = nJoursBreadth > 0 ? round2(sumPctBaisses / nJoursBreadth) : null;
    const largeurHausses5j = nJoursBreadth > 0 ? round2(sumPctHausses / nJoursBreadth) : null;
    // Mapping : 25 % de titres en baisse -> 0 ; 80 % de titres en baisse -> 100
    const scoreBreadth =
      largeurBaissiere5j != null ? clamp100(((largeurBaissiere5j - 25) / 55) * 100) : null;

    // 3. Volatilité réalisée (rang empirique BRVM-V si présent, sinon vol 20j BRVMC mappée [5 %..22 %])
    const nerv = nervMap.get(d);
    let volBrute: number | null = null;
    let uniteVol = '%';
    let scoreVol: number | null = null;
    if (nerv?.rang != null) {
      volBrute = nerv.valeur ?? nerv.rang;
      scoreVol = clamp100(nerv.rang);
    } else if (nerv?.valeur != null) {
      volBrute = nerv.valeur;
      scoreVol = clamp100(((nerv.valeur - 6) / 14) * 100);
    } else if (volBrvmc20[t] != null) {
      volBrute = volBrvmc20[t]!;
      uniteVol = '% (BRVMC 20j)';
      scoreVol = clamp100(((volBrute - 5) / 17) * 100);
    }

    // 4. Diffusion sectorielle des baisses sur 20 séances (pondérée par capitalisation)
    let diffSecPct: number | null = null;
    if (t >= 20) {
      const bAct = parDateActions.get(d);
      const b20 = parDateActions.get(ddSerie[t - 20]!.date_marche);
      if (bAct && b20 && bAct.parCode.size >= 10 && b20.parCode.size >= 10) {
        const secPerf = new Map<string, { num: number; den: number }>();
        for (const [code, cur] of bAct.parCode.entries()) {
          const anc = b20.parCode.get(code);
          if (!anc || !(anc.cours > 0)) continue;
          const r = (cur.cours / anc.cours - 1) * 100;
          const acc = secPerf.get(cur.secteur) ?? { num: 0, den: 0 };
          acc.num += r * cur.cap;
          acc.den += cur.cap;
          secPerf.set(cur.secteur, acc);
        }
        let capTot = 0;
        let capEnBaisse = 0;
        for (const acc of secPerf.values()) {
          if (acc.den <= 0) continue;
          const rSec = acc.num / acc.den;
          capTot += acc.den;
          if (rSec < 0) capEnBaisse += acc.den;
        }
        if (capTot > 0) diffSecPct = round2((100 * capEnBaisse) / capTot);
      }
    }
    const scoreSecteur = diffSecPct != null ? clamp100(diffSecPct) : null;

    // 5. Pression vendeuse sur volumes (moyenne 5 séances de volumes baissiers / volumes totaux)
    const partVolBaisse5j = nJoursVol > 0 ? round2(sumVolBaisseRatio / nJoursVol) : null;
    const scoreVolPression =
      partVolBaisse5j != null ? clamp100(((partVolBaisse5j - 20) / 65) * 100) : null;

    // 6. Momentum baissier court terme 20 séances (0 % -> 0, -12 % -> 100)
    const perf20j =
      t >= 20 && ddSerie[t - 20]!.valeur > 0
        ? round2(((pt.valeur / ddSerie[t - 20]!.valeur) - 1) * 100)
        : null;
    const scoreMom = perf20j != null ? clamp100((-perf20j / 12) * 100) : null;

    // Assemblage & renormalisation transparente des poids disponibles
    const brutes: Record<CleComposanteStress, { val: number | null; unite: string; score: number | null }> = {
      drawdown_composite: { val: ddVal, unite: '%', score: scoreDd },
      largeur_baissiere: { val: largeurBaissiere5j, unite: '% titres', score: scoreBreadth },
      volatilite_brvmv: { val: volBrute, unite: uniteVol, score: scoreVol },
      diffusion_sectorielle: { val: diffSecPct, unite: '% cap.', score: scoreSecteur },
      pression_volumes: { val: partVolBaisse5j, unite: '% vol.', score: scoreVolPression },
      momentum_court_terme: { val: perf20j, unite: '%', score: scoreMom },
    };

    let sommePoidsActifs = 0;
    let nbActives = 0;
    for (const c of CLES) {
      if (brutes[c].score != null) {
        sommePoidsActifs += POIDS_NOMINAUX_STRESS[c];
        nbActives++;
      }
    }

    let totalPond = 0;
    const composantes = {} as MapComposantesStress;
    for (const c of CLES) {
      const b = brutes[c];
      const pNom = POIDS_NOMINAUX_STRESS[c];
      const pEff = b.score != null && sommePoidsActifs > 0 ? round4(pNom / sommePoidsActifs) : 0;
      if (b.score != null) totalPond += b.score * pEff;
      const detail: DetailComposanteStress = {
        valeur_brute: b.val,
        unite_brute: b.unite,
        score_0_100: b.score,
        poids_nominal: pNom,
        poids_effectif: pEff,
      };
      composantes[c] = detail;
    }

    const stressIndex = clamp100(totalPond);

    // Observables factuels complémentaires (MM20, delta BRVM-V 20j, ratio volume vs médiane 60j)
    let ecartMm20: number | null = null;
    if (t >= 19) {
      let s = 0;
      for (let k = t - 19; k <= t; k++) s += ddSerie[k]!.valeur;
      const mm20 = s / 20;
      if (mm20 > 0) ecartMm20 = round2(((pt.valeur / mm20) - 1) * 100);
    }

    let varBrvmv20j: number | null = null;
    if (t >= 20) {
      const nAct = nervMap.get(d)?.valeur ?? volBrvmc20[t];
      const n20 = nervMap.get(ddSerie[t - 20]!.date_marche)?.valeur ?? volBrvmc20[t - 20];
      if (nAct != null && n20 != null) varBrvmv20j = round2(nAct - n20);
    }

    let ratioVol60j: number | null = null;
    const bJour = parDateActions.get(d);
    if (bJour && bJour.volTotal > 0 && t >= 20) {
      const histVols: number[] = [];
      for (let k = Math.max(0, t - 60); k < t; k++) {
        const bk = parDateActions.get(ddSerie[k]!.date_marche);
        if (bk && bk.volTotal > 0) histVols.push(bk.volTotal);
      }
      const med = mediane(histVols);
      if (med && med > 0) ratioVol60j = round2(bJour.volTotal / med);
    }

    brutsRows.push({
      date_marche: d,
      stress_index: stressIndex,
      regime: classifierRegimeStress(stressIndex),
      couverture_composantes_pct: round2(sommePoidsActifs * 100),
      nb_composantes_actives: nbActives,
      composantes,
      variation_5j_pts: null,
      variation_20j_pts: null,
      variation_60j_pts: null,
      observables_marche: {
        brvmc_cloture: pt.valeur,
        drawdown_brvmc_pct: ddVal,
        largeur_hausses_5j_pct: largeurHausses5j,
        ecart_brvmc_mm20_pct: ecartMm20,
        variation_brvmv_20j_pts: varBrvmv20j,
        ratio_volume_60j: ratioVol60j,
      },
    });
  }

  // Calcul des variations historiques (5j / 20j / 60j séances) sur la série produite
  for (let i = 0; i < brutsRows.length; i++) {
    const cur = brutsRows[i]!;
    if (i >= 5) cur.variation_5j_pts = round2(cur.stress_index - brutsRows[i - 5]!.stress_index);
    if (i >= 20) cur.variation_20j_pts = round2(cur.stress_index - brutsRows[i - 20]!.stress_index);
    if (i >= 60) cur.variation_60j_pts = round2(cur.stress_index - brutsRows[i - 60]!.stress_index);
  }

  return brutsRows;
}
