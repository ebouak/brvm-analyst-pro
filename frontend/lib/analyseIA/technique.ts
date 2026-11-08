/**
 * Indicateurs techniques recalculés sur les clôtures en base (module PUR),
 * avec les mêmes fonctions que la fiche (lib/indicators). Des constats de
 * position, jamais une prévision.
 */
import { macdSeries, rsi, sma } from '@/lib/indicators';
import type { PointCours } from './types';

export interface LectureTechniqueIA {
  seance: string;
  seances_utilisees: number;
  cours: number;
  rsi14: number | null;
  zone_rsi: 'haute' | 'basse' | 'neutre' | null;
  macd: number | null;
  signal_macd: number | null;
  position_macd: 'au-dessus' | 'en dessous' | null;
  mm20: number | null;
  mm50: number | null;
}

const arrondi = (n: number | null, d = 2) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

export function lireTechnique(points: PointCours[]): LectureTechniqueIA | null {
  const pts = points.filter((x) => Number.isFinite(x.cours) && x.cours > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 15) return null;
  const closes = pts.map((x) => x.cours);
  const r = arrondi(rsi(closes, 14));
  const m = macdSeries(closes);
  const dernier = m[m.length - 1];
  const macd = arrondi(dernier?.macd ?? null);
  const sig = arrondi(dernier?.signal ?? null);
  return {
    seance: pts[pts.length - 1]!.date,
    seances_utilisees: pts.length,
    cours: closes[closes.length - 1]!,
    rsi14: r,
    zone_rsi: r == null ? null : r >= 70 ? 'haute' : r <= 30 ? 'basse' : 'neutre',
    macd,
    signal_macd: sig,
    position_macd: macd == null || sig == null ? null : macd >= sig ? 'au-dessus' : 'en dessous',
    mm20: arrondi(sma(closes, 20)),
    mm50: arrondi(sma(closes, 50)),
  };
}
