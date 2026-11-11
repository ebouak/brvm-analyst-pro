import type { SignalDaily } from '@/lib/types';

/**
 * Note publique d'une valeur (audit F-04).
 *
 * `signals_daily` n'est plus lisible sans session : les pages publiques lisent
 * `public.signaux_publics()`, qui ne rend que la DERNIÈRE séance et cinq
 * colonnes. Ce module convertit ces lignes vers `SignalDaily` pour les
 * composants existants. Les sous-scores et l'explication restent ABSENTS
 * (null) : ils ne quittent la base que pour un compte autorisé.
 */
export interface LigneSignalPublic {
  code: string;
  date_marche: string;
  signal: string | null;
  score_total: number | null;
  confiance: number | null;
}

const SIGNAUX = new Set(['BUY', 'HOLD', 'SELL']);

/** null si la ligne n'a ni signal reconnu ni score : rien à afficher, rien à inventer. */
export function versSignalPublic(l: LigneSignalPublic): SignalDaily | null {
  if (!l.signal || !SIGNAUX.has(l.signal) || l.score_total == null) return null;
  return {
    code: l.code,
    date_marche: l.date_marche,
    signal: l.signal as SignalDaily['signal'],
    score_total: Number(l.score_total),
    confiance: l.confiance == null ? null : Number(l.confiance),
    score_variation: null,
    score_volume: null,
    score_rsi: null,
    bonus_tendance: null,
    penalite_liquidite: null,
    explication: null,
  };
}

/** Garde les lignes d'une séance donnée (la fonction rend la dernière séance de CHAQUE valeur). */
export function signauxPublicsDeLaSeance(lignes: LigneSignalPublic[], date: string): SignalDaily[] {
  return lignes
    .filter((l) => l.date_marche === date)
    .map(versSignalPublic)
    .filter((s): s is SignalDaily => s !== null);
}
