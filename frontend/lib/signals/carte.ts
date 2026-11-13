/**
 * Carte des signaux sur deux axes — fonctions PURES, testées.
 *
 * Le score composite additionne des facteurs qui tirent en sens contraire :
 * la variation et le MACD récompensent la HAUSSE, le RSI récompense la
 * SURVENTE (score_rsi = (50 − RSI) / bande). Une valeur en forte hausse et
 * surachetée s'annule donc vers « Neutre » (SLBC +7,36 % le 12/11 : score
 * +0,55, RSI 80). Séparer les deux familles rend lisible ce que le score
 * moyenne. AUCUN seuil ni score n'est modifié ici (CLAUDE.md §9 : les seuils
 * ne changent pas sans verdict du banc d'évaluation) : c'est une lecture des
 * sous-scores déjà publiés.
 */

export interface SousScores {
  code: string;
  score_variation?: number | null;
  score_macd?: number | null;
  score_rsi?: number | null;
  signal?: string | null;
}

export interface PointCarte {
  code: string;
  /** Élan : moyenne des sous-scores variation et MACD, de −1 à +1. */
  tendance: number;
  /** Position RSI : +1 survendu, −1 suracheté (même signe que score_rsi). */
  survente: number;
  signal: string | null;
}

const fini = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);
const borne = (x: number) => Math.max(-1, Math.min(1, x));

export function pointCarte(s: SousScores): PointCarte | null {
  const elan = [s.score_variation, s.score_macd].filter(fini);
  if (!elan.length || !fini(s.score_rsi)) return null;
  return {
    code: s.code,
    tendance: borne(elan.reduce((a, b) => a + b, 0) / elan.length),
    survente: borne(s.score_rsi),
    signal: s.signal ?? null,
  };
}

export type Quadrant = 'hausse_survendu' | 'hausse_surachete' | 'baisse_survendu' | 'baisse_surachete';

/** Libellés DESCRIPTIFS : ils disent ce que montrent les indicateurs, pas quoi faire. */
export const LIBELLE_QUADRANT: Record<Quadrant, string> = {
  hausse_survendu: 'Élan haussier, RSI bas',
  hausse_surachete: 'Élan haussier, RSI haut',
  baisse_survendu: 'Élan baissier, RSI bas',
  baisse_surachete: 'Élan baissier, RSI haut',
};

export function quadrant(p: PointCarte): Quadrant {
  if (p.tendance >= 0) return p.survente >= 0 ? 'hausse_survendu' : 'hausse_surachete';
  return p.survente >= 0 ? 'baisse_survendu' : 'baisse_surachete';
}

export function pointsCarte(lignes: SousScores[]): { points: PointCarte[]; ecartees: number } {
  const points: PointCarte[] = [];
  for (const l of lignes) {
    const p = pointCarte(l);
    if (p) points.push(p);
  }
  return { points, ecartees: lignes.length - points.length };
}
