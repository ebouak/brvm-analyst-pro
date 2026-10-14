/**
 * Bloc « Mon portefeuille » (spec §4.5). PUR et testé.
 * Aucun nouveau calcul financier : tout vient de `derivePortfolio` ; on ne
 * fait ici que relier ses positions aux cours de la séance affichée.
 */
import type { EnrichedPosition } from '@/lib/portfolio/derive';
import type { LignePerf } from './performanceJour';

export interface CoursSeance {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  date_marche: string;
}

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const avecCours = (p: EnrichedPosition) => !p.isLiquidites && fini(p.cours) && p.cours > 0;

/** Index par code ; une seule séance si `dateMarche` est donné ; une valeur nulle n'écrase jamais une valeur connue. */
function indexerSeance(seance: CoursSeance[], dateMarche?: string): Map<string, CoursSeance> {
  const m = new Map<string, CoursSeance>();
  for (const s of seance) {
    if (dateMarche !== undefined && s.date_marche !== dateMarche) continue;
    const k = s.code.trim().toUpperCase();
    const ancien = m.get(k);
    if (ancien) {
      m.set(k, {
        ...s,
        cours_jour: fini(s.cours_jour) ? s.cours_jour : ancien.cours_jour,
        variation_pct: fini(s.variation_pct) ? s.variation_pct : ancien.variation_pct,
      });
    } else m.set(k, s);
  }
  return m;
}

/** Lignes d'entrée de `performanceJour`, à partir des cours de LA séance affichée. */
export function lignesPerfDepuis(positions: EnrichedPosition[], seance: CoursSeance[], dateMarche?: string): LignePerf[] {
  const parCode = indexerSeance(seance, dateMarche);
  return positions
    .filter((p) => !p.isLiquidites)
    .map((p) => {
      const s = parCode.get(p.code.trim().toUpperCase());
      return {
        code: p.code,
        quantite: p.quantite,
        cours: s && fini(s.cours_jour) ? s.cours_jour : null,
        variationPct: s && fini(s.variation_pct) ? s.variation_pct : null,
        dateMarche: s ? s.date_marche : null,
      };
    });
}

export function variationsDuJour(seance: CoursSeance[], dateMarche?: string): Map<string, number | null> {
  return new Map([...indexerSeance(seance, dateMarche)].map(([k, s]) => [k, fini(s.variation_pct) ? s.variation_pct : null]));
}

export interface Contribution { code: string; pnl: number; largeur: number }

/** Contribution de chaque position à la plus-value latente ; `largeur` ∈ [0,1] relative au plus grand écart. */
export function contributions(positions: EnrichedPosition[]): Contribution[] {
  const lignes = positions.filter((p) => avecCours(p) && fini(p.pnl));
  const max = Math.max(0, ...lignes.map((p) => Math.abs(p.pnl)));
  return lignes
    .map((p) => ({ code: p.code, pnl: p.pnl, largeur: max > 0 ? Math.abs(p.pnl) / max : 0 }))
    .sort((x, y) => y.pnl - x.pnl);
}

export interface SyntheseValorisee {
  valeur: number;
  investi: number;
  pnl: number;
  pnlPct: number | null;
  exclus: string[];
}

/** Liquidités + positions avec un cours > 0. Une position sans cours n'est jamais comptée à 0 : elle est exclue et nommée. */
export function syntheseValorisee(positions: EnrichedPosition[]): SyntheseValorisee {
  let valeur = 0;
  let investi = 0;
  let pnl = 0;
  const exclus: string[] = [];
  for (const p of positions) {
    if (p.isLiquidites) {
      if (fini(p.valeur)) valeur += p.valeur;
      continue;
    }
    if (!avecCours(p)) {
      exclus.push(p.code);
      continue;
    }
    valeur += fini(p.valeur) ? p.valeur : 0;
    investi += fini(p.investi) ? p.investi : 0;
    pnl += fini(p.pnl) ? p.pnl : 0;
  }
  return { valeur, investi, pnl, pnlPct: investi > 0 ? pnl / investi : null, exclus };
}

/** Répartition par secteur sur le même sous-ensemble valorisé ; poids recalculés sur ce sous-ensemble. */
export function secteursValorises(positions: EnrichedPosition[]): { secteur: string; valeur: number; poids: number }[] {
  const par = new Map<string, number>();
  for (const p of positions) {
    if (!p.isLiquidites && !avecCours(p)) continue;
    if (!fini(p.valeur)) continue;
    const s = p.isLiquidites ? 'Liquidités' : p.secteur || 'Autres';
    par.set(s, (par.get(s) ?? 0) + p.valeur);
  }
  const total = [...par.values()].reduce((a, b) => a + b, 0);
  return [...par]
    .map(([secteur, valeur]) => ({ secteur, valeur, poids: total > 0 ? valeur / total : 0 }))
    .sort((a, b) => b.valeur - a.valeur);
}

/** Sous-échantillonnage régulier, premier et dernier points toujours conservés. */
export function echantillonner<T>(points: T[], max = 365): T[] {
  if (points.length <= max || max < 2) return points;
  const out: T[] = [];
  const pas = (points.length - 1) / (max - 1);
  let dernier = -1;
  for (let i = 0; i < max; i++) {
    const idx = i === max - 1 ? points.length - 1 : Math.round(i * pas);
    if (idx !== dernier) out.push(points[idx]);
    dernier = idx;
  }
  return out;
}
