import { fmtFcfa, fmtNumber } from '@/lib/format';
import { deviseDe, type Comparaison, type Unite } from './lecture';

/**
 * Formatage des agrégats bancaires pour l'affichage — un seul endroit, qui
 * écrit TOUJOURS l'unité de la ligne (avenant du 2026-11-15) : « 300,00 Md
 * FCFA », « 1,20 Md USD », « 14,39 % ». Aucune surface n'ajoute « FCFA » en
 * dur à côté d'un agrégat de lib/bank/lecture.ts.
 */
const moins = (s: string) => s.replace('-', '−');

export function montantLigne(v: number, unite: Unite): string {
  if (unite === 'pct') return `${fmtNumber(v, 2)} %`;
  return moins(`${fmtFcfa(v)} ${deviseDe(unite)}`);
}

/** « +10,3 % », « −1,2 pt » ; « — » sans variation calculable. */
export function variationLigne(c: Comparaison | null): string {
  if (c?.variation == null) return '—';
  const pts = c.uniteVariation === 'pts';
  return `${c.variation >= 0 ? '+' : '−'}${fmtNumber(Math.abs(c.variation), 1)}${pts ? (Math.abs(c.variation) >= 2 ? ' pts' : ' pt') : ' %'}`;
}

/** Ratio calculé (fraction) → « 45,0 % ». */
export function ratioLigne(fraction: number): string {
  return `${fmtNumber(fraction * 100, 1)} %`;
}
