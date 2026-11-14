/**
 * Courbe J−10 / J+10 et tableau des horizons d'une fiche d'événement (lot 5).
 * PUR. Les rendements par horizon passent par `eventStudy` (une seule méthode dans le dépôt).
 */
import { eventStudy, HORIZONS, type DatedClose } from '@/lib/eventStudy';

export interface PointCourbe {
  /** Position relative à J0 (−10 … +10). */
  decalage: number;
  date: string;
  /** Cours du titre ramené à 100 en J0 ; null si le cours manque. */
  titre: number | null;
  /** Indice ramené à 100 en J0 ; null si l'indice manque à cette date. */
  indice: number | null;
}

export interface CourbeEvenement {
  j0Date: string;
  points: PointCourbe[];
  /** Séances réellement disponibles après J0 (plafonnées à `apres`). */
  seancesApres: number;
}

const base100 = (v: number | null, base: number | null) =>
  v == null || base == null || base === 0 ? null : (v / base) * 100;

/** null si J0 est introuvable (aucune séance à partir de la date) ou si le cours de J0 manque. */
export function fenetreCourbe(
  serieTitre: DatedClose[],
  serieIndice: DatedClose[],
  datePublication: string,
  avant = 10,
  apres = 10,
): CourbeEvenement | null {
  const j0 = serieTitre.findIndex((d) => d.date >= datePublication);
  if (j0 < 0) return null;
  const baseTitre = serieTitre[j0]!.close;
  if (baseTitre == null || baseTitre === 0) return null;
  const idx = new Map(serieIndice.map((d) => [d.date, d.close]));
  const baseIndice = idx.get(serieTitre[j0]!.date) ?? null;
  const debut = Math.max(0, j0 - avant);
  const fin = Math.min(serieTitre.length - 1, j0 + apres);
  const points: PointCourbe[] = [];
  for (let i = debut; i <= fin; i++) {
    const s = serieTitre[i]!;
    points.push({
      decalage: i - j0,
      date: s.date,
      titre: base100(s.close, baseTitre),
      indice: base100(idx.get(s.date) ?? null, baseIndice),
    });
  }
  return { j0Date: serieTitre[j0]!.date, points, seancesApres: fin - j0 };
}

export interface LigneHorizon {
  horizon: number;
  /** null tant que l'horizon n'est pas atteint (jamais 0 par défaut). */
  titre: number | null;
  indice: number | null;
  ecart: number | null;
}

export function tableauHorizons(
  serieTitre: DatedClose[],
  serieIndice: DatedClose[],
  datePublication: string,
): LigneHorizon[] {
  return HORIZONS.map((h) => {
    const r = eventStudy(serieTitre, serieTitre.map(() => null), serieIndice, datePublication, h);
    if (!r.found || !r.fenetreComplete) return { horizon: h, titre: null, indice: null, ecart: null };
    return { horizon: h, titre: r.retPost, indice: r.indexRetPost, ecart: r.abnormalReturnPost };
  });
}
