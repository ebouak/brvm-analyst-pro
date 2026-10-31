/**
 * Banc d'évaluation des signaux — fonctions PURES, testées.
 *
 * QUESTION. Un score de signal a-t-il annoncé la suite ? Pour chaque tranche de
 * score et chaque horizon (en séances), on mesure le rendement de la valeur
 * ENTRE la clôture du jour du signal et la clôture h séances plus tard,
 * comparé à la moyenne des valeurs notées le même jour (l'« écart au
 * marché » : neutralise la tendance générale de la période).
 *
 * POURQUOI CE MODULE (2026-10-31). 97,8 % des signaux étaient « conserver » ;
 * abaisser le seuil aurait fabriqué des recommandations. Une première mesure
 * a montré l'inverse de l'intuition : les scores ≥ 0,6 avaient fait MOINS
 * bien que le marché à 20 séances (−2,9 %, 39 cas). Mais 39 cas sur des
 * fenêtres qui se chevauchent ne prouvent rien. D'où trois règles :
 *
 * 1. INDÉPENDANCE. Deux signaux d'une même valeur à un jour d'écart partagent
 *    19 séances sur 20 : ce n'est pas deux observations. On ne garde, par
 *    valeur et par tranche, qu'un signal toutes les h séances.
 * 2. INCERTITUDE. Intervalle de confiance à 95 % par bootstrap (tirage
 *    reproductible), sur l'écart au marché.
 * 3. VERDICT. « Prouvé » seulement si l'intervalle exclut zéro ET qu'il y a au
 *    moins MIN_INDEPENDANTS cas indépendants. Sinon « non prouvé » ou
 *    « insuffisant » — jamais une conclusion arrachée à un petit échantillon.
 *
 * Règle de gouvernance (CLAUDE.md) : aucun seuil de `scoring/score.ts` ne
 * change sans un verdict « prouvé » de ce banc dans le bon sens.
 */

export interface PointSignal { code: string; date: string; score: number }
export interface PointCours { code: string; date: string; cours: number }
/**
 * Tranche [min ; max[ — `max` exclu, sauf l'infini. `minExclu` aligne une borne
 * sur un seuil STRICT du moteur (achat si score > 0,6 dans scoring/score.ts) ;
 * `maxInclu` ferme alors la tranche du dessous, sans quoi 0,6 pile ne serait
 * compté nulle part (trou trouvé par le test des bornes).
 */
export interface Tranche { id: string; libelle: string; min: number; max: number; minExclu?: boolean; maxInclu?: boolean }

export const TRANCHES_DEFAUT: Tranche[] = [
  { id: 'achat', libelle: '> 0,60 (achat actuel)', min: 0.6, max: Infinity, minExclu: true },
  { id: 'p50', libelle: '0,50 – 0,60', min: 0.5, max: 0.6, maxInclu: true },
  { id: 'p45', libelle: '0,45 – 0,50', min: 0.45, max: 0.5 },
  { id: 'p30', libelle: '0,30 – 0,45', min: 0.3, max: 0.45 },
  { id: 'neutre', libelle: 'neutre (−0,30 – 0,30)', min: -0.3, max: 0.3 },
  { id: 'm30', libelle: '−0,45 – −0,30', min: -0.45, max: -0.3 },
  { id: 'm45', libelle: '−0,60 – −0,45', min: -0.6, max: -0.45 },
  { id: 'vente', libelle: '< −0,60 (vente actuelle)', min: -Infinity, max: -0.6 },
];

export const HORIZONS_DEFAUT = [5, 20, 60];
export const MIN_INDEPENDANTS = 30;
const MIN_POUR_INTERVALLE = 10;

export type Verdict = 'prouve_hausse' | 'prouve_baisse' | 'non_prouve' | 'insuffisant';

export interface ResultatTranche {
  tranche: Tranche;
  horizon: number;
  /** Tous les signaux de la tranche ayant un cours à t et t+h. */
  n: number;
  /** Après dé-chevauchement : la base de toutes les statistiques ci-dessous. */
  nIndependants: number;
  rendementMoyen: number | null;
  excesMoyen: number | null;
  pctBatMarche: number | null;
  ic95: [number, number] | null;
  verdict: Verdict;
}

/** PRNG mulberry32 : bootstrap reproductible d'une exécution à l'autre. */
function prng(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const moyenne = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Intervalle à 95 % de la moyenne, par rééchantillonnage avec remise. */
export function intervalleBootstrap(xs: number[], tirages = 2000, graine = 42): [number, number] | null {
  if (xs.length < MIN_POUR_INTERVALLE) return null;
  const alea = prng(graine);
  const moyennes: number[] = [];
  for (let k = 0; k < tirages; k++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(alea() * xs.length)] as number;
    moyennes.push(s / xs.length);
  }
  moyennes.sort((a, b) => a - b);
  return [moyennes[Math.floor(0.025 * tirages)] as number, moyennes[Math.ceil(0.975 * tirages) - 1] as number];
}

export function verdictDe(nIndependants: number, ic: [number, number] | null): Verdict {
  if (nIndependants < MIN_INDEPENDANTS || !ic) return 'insuffisant';
  if (ic[0] > 0) return 'prouve_hausse';
  if (ic[1] < 0) return 'prouve_baisse';
  return 'non_prouve';
}

const dansTranche = (t: Tranche, s: number) =>
  (t.minExclu ? s > t.min : s >= t.min) && (t.max === Infinity || (t.maxInclu ? s <= t.max : s < t.max));

export function evaluerSignaux(
  signaux: PointSignal[],
  cours: PointCours[],
  opts: { horizons?: number[]; tranches?: Tranche[]; graine?: number } = {},
): ResultatTranche[] {
  const horizons = opts.horizons ?? HORIZONS_DEFAUT;
  const tranches = opts.tranches ?? TRANCHES_DEFAUT;

  // Séries de clôtures par valeur, en ordre chronologique ; position par date.
  const series = new Map<string, { dates: string[]; cours: number[]; pos: Map<string, number> }>();
  for (const c of [...cours].filter((c) => c.cours > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    let s = series.get(c.code);
    if (!s) series.set(c.code, (s = { dates: [], cours: [], pos: new Map() }));
    if (s.pos.has(c.date)) continue;
    s.pos.set(c.date, s.dates.length);
    s.dates.push(c.date);
    s.cours.push(c.cours);
  }

  const resultats: ResultatTranche[] = [];
  for (const h of horizons) {
    // 1. Rendement à h séances de chaque signal (pas de cours futur → écarté).
    const obs: { code: string; date: string; pos: number; score: number; r: number }[] = [];
    for (const sg of signaux) {
      const s = series.get(sg.code);
      const p = s?.pos.get(sg.date);
      if (!s || p == null || p + h >= s.cours.length) continue;
      const depart = s.cours[p] as number;
      const arrivee = s.cours[p + h] as number;
      obs.push({ code: sg.code, date: sg.date, pos: p, score: sg.score, r: (arrivee / depart - 1) * 100 });
    }
    // 2. Moyenne du marché le même jour, sur les valeurs notées ce jour-là.
    const parJour = new Map<string, number[]>();
    for (const o of obs) (parJour.get(o.date) ?? parJour.set(o.date, []).get(o.date)!).push(o.r);
    const marche = new Map([...parJour].map(([d, rs]) => [d, moyenne(rs)]));

    for (const t of tranches) {
      const dedans = obs.filter((o) => dansTranche(t, o.score)).sort((a, b) => (a.code === b.code ? a.pos - b.pos : a.code < b.code ? -1 : 1));
      // 3. Dé-chevauchement : par valeur, un signal au plus toutes les h séances.
      const indep: typeof dedans = [];
      const dernier = new Map<string, number>();
      for (const o of dedans) {
        const d = dernier.get(o.code);
        if (d != null && o.pos - d < h) continue;
        indep.push(o);
        dernier.set(o.code, o.pos);
      }
      const exces = indep.map((o) => o.r - (marche.get(o.date) as number));
      const ic = intervalleBootstrap(exces, 2000, opts.graine ?? 42);
      resultats.push({
        tranche: t,
        horizon: h,
        n: dedans.length,
        nIndependants: indep.length,
        rendementMoyen: indep.length ? moyenne(indep.map((o) => o.r)) : null,
        excesMoyen: exces.length ? moyenne(exces) : null,
        pctBatMarche: exces.length ? (100 * exces.filter((x) => x > 0).length) / exces.length : null,
        ic95: ic,
        verdict: verdictDe(indep.length, ic),
      });
    }
  }
  return resultats;
}

const LIBELLE_VERDICT: Record<Verdict, string> = {
  prouve_hausse: '✅ prouvé : surperforme',
  prouve_baisse: '🔻 prouvé : sous-performe',
  non_prouve: '— non prouvé',
  insuffisant: '⏳ échantillon insuffisant',
};

const pc = (x: number | null) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(2)} %`);

/** Rapport Markdown (résumé du run GitHub, journal). */
export function formaterRapport(res: ResultatTranche[], contexte: { debut: string; fin: string; nSignaux: number }): string {
  const lignes = [
    `## Banc d'évaluation des signaux`,
    ``,
    `Signaux du ${contexte.debut} au ${contexte.fin} (${contexte.nSignaux} notes). Écart au marché = rendement de la valeur moins la moyenne des valeurs notées le même jour. Statistiques sur les cas **indépendants** (un par valeur toutes les h séances). « Prouvé » = intervalle à 95 % hors de zéro et au moins ${MIN_INDEPENDANTS} cas indépendants.`,
  ];
  for (const h of [...new Set(res.map((r) => r.horizon))]) {
    lignes.push('', `### Horizon ${h} séances`, '', '| Score | Cas | Indép. | Écart moyen | IC 95 % | Bat le marché | Verdict |', '|---|---:|---:|---:|---|---:|---|');
    for (const r of res.filter((x) => x.horizon === h)) {
      const ic = r.ic95 ? `[${pc(r.ic95[0])} ; ${pc(r.ic95[1])}]` : '—';
      const bat = r.pctBatMarche == null ? '—' : `${r.pctBatMarche.toFixed(0)} %`;
      lignes.push(`| ${r.tranche.libelle} | ${r.n} | ${r.nIndependants} | ${pc(r.excesMoyen)} | ${ic} | ${bat} | ${LIBELLE_VERDICT[r.verdict]} |`);
    }
  }
  return lignes.join('\n');
}
