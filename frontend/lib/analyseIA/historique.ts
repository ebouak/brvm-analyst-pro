/**
 * Résumé de TOUT l'historique de cours d'une valeur (module PUR). Les séances
 * arrivent paginées depuis la base ; ce résumé tient dans le contexte d'un
 * modèle, quelle que soit la profondeur, et sert aussi le gabarit Jev.
 */
import type { PointCours } from './types';

export interface AnneeCours {
  annee: number;
  du: string;
  au: string;
  seances: number;
  cours_debut: number;
  cours_fin: number;
  variation_pct: number | null;
  plus_haut: number;
  plus_bas: number;
}

export interface ResumeHistorique {
  du: string;
  au: string;
  /** Première séance en base, quand le résumé porte sur une période plus courte. */
  historique_commence_le: string;
  seances_cotees: number;
  cours_debut: number;
  cours_fin: number;
  variation_pct: number | null;
  plus_haut: { cours: number; date: string };
  plus_bas: { cours: number; date: string };
  volume_moyen: number | null;
  par_annee: AnneeCours[];
  plus_fortes_hausses: { date: string; variation_pct: number }[];
  plus_fortes_baisses: { date: string; variation_pct: number }[];
  dernieres_seances: { date: string; cours: number; variation_pct: number | null; volume: number | null }[];
}

const arrondi = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const variation = (a: number, b: number) => (a > 0 ? arrondi(((b - a) / a) * 100) : null);

export function dateDepuis(aujourdhui: string, jours: number | null): string | null {
  if (jours == null) return null;
  const t = Date.parse(`${aujourdhui}T00:00:00Z`) - jours * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function resumerHistorique(points: PointCours[], depuis: string | null): ResumeHistorique | null {
  const tous = points
    .filter((x) => Number.isFinite(x.cours) && x.cours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (tous.length === 0) return null;
  const pts = depuis ? tous.filter((x) => x.date >= depuis) : tous;
  if (pts.length < 2) return null;

  const debut = pts[0]!;
  const fin = pts[pts.length - 1]!;
  let haut = debut;
  let bas = debut;
  for (const x of pts) {
    if (x.cours > haut.cours) haut = x;
    if (x.cours < bas.cours) bas = x;
  }
  const volumes = pts.map((x) => x.volume).filter((v): v is number => v != null && Number.isFinite(v));

  const parAnnee = new Map<number, PointCours[]>();
  for (const x of pts) {
    const a = Number(x.date.slice(0, 4));
    if (!parAnnee.has(a)) parAnnee.set(a, []);
    parAnnee.get(a)!.push(x);
  }
  const par_annee: AnneeCours[] = [...parAnnee.entries()].map(([annee, l]) => {
    const c = l.map((x) => x.cours);
    return {
      annee,
      du: l[0]!.date,
      au: l[l.length - 1]!.date,
      seances: l.length,
      cours_debut: l[0]!.cours,
      cours_fin: l[l.length - 1]!.cours,
      variation_pct: variation(l[0]!.cours, l[l.length - 1]!.cours),
      plus_haut: Math.max(...c),
      plus_bas: Math.min(...c),
    };
  });

  const avecVar = pts.filter((x): x is PointCours & { variation_pct: number } => x.variation_pct != null && Number.isFinite(x.variation_pct));
  const hausses = avecVar
    .filter((x) => x.variation_pct > 0)
    .sort((a, b) => b.variation_pct - a.variation_pct)
    .slice(0, 3)
    .map((x) => ({ date: x.date, variation_pct: x.variation_pct }));
  const baisses = avecVar
    .filter((x) => x.variation_pct < 0)
    .sort((a, b) => a.variation_pct - b.variation_pct)
    .slice(0, 3)
    .map((x) => ({ date: x.date, variation_pct: x.variation_pct }));

  return {
    du: debut.date,
    au: fin.date,
    historique_commence_le: tous[0]!.date,
    seances_cotees: pts.length,
    cours_debut: debut.cours,
    cours_fin: fin.cours,
    variation_pct: variation(debut.cours, fin.cours),
    plus_haut: { cours: haut.cours, date: haut.date },
    plus_bas: { cours: bas.cours, date: bas.date },
    volume_moyen: volumes.length ? Math.round(volumes.reduce((s, v) => s + v, 0) / volumes.length) : null,
    par_annee,
    plus_fortes_hausses: hausses,
    plus_fortes_baisses: baisses,
    dernieres_seances: pts.slice(-10).map((x) => ({ date: x.date, cours: x.cours, variation_pct: x.variation_pct, volume: x.volume })),
  };
}
