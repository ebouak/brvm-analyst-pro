/**
 * Contexte de position : lit le signal en fonction de la détention réelle de
 * l'utilisateur (PRU / plus-value latente). Évite de dire « vendre » sèchement
 * sans tenir compte du cours d'achat.
 *
 * Fonction pure et testable.
 */

import type { SignalLabel } from './technical';

export interface PositionInput {
  quantite: number;
  prix_entree: number; // PRU
}

export interface PositionContext {
  held: boolean;
  pru: number | null;
  quantity: number | null;
  latentPnlPct: number | null;
  reading: string;
}

/** Seuil de plus-value au-delà duquel on suggère de sécuriser sur un signal vendeur. */
const STRONG_GAIN_PCT = 10;

export function readPosition(
  pos: PositionInput | null,
  cours: number | null,
  signal: SignalLabel,
): PositionContext {
  const held = pos != null && pos.quantite > 0;

  if (!held) {
    const reading =
      signal === 'BUY'
        ? 'Vous ne détenez pas cette valeur : le signal suggère un point d’entrée potentiel.'
        : signal === 'SELL'
          ? 'Vous ne détenez pas cette valeur : rester à l’écart, attendre un repli.'
          : 'Vous ne détenez pas cette valeur : pas de signal franc, à surveiller.';
    return { held: false, pru: null, quantity: null, latentPnlPct: null, reading };
  }

  const pru = pos!.prix_entree;
  const quantity = pos!.quantite;
  const latentPnlPct =
    cours != null && pru > 0 ? ((cours - pru) / pru) * 100 : null;

  const pnlTxt =
    latentPnlPct != null
      ? `${latentPnlPct >= 0 ? '+' : ''}${latentPnlPct.toFixed(1)}%`
      : '—';

  let reading: string;
  if (signal === 'SELL') {
    if (latentPnlPct != null && latentPnlPct >= STRONG_GAIN_PCT) {
      reading = `Vous détenez ${quantity} titre${quantity > 1 ? 's' : ''} en plus-value (${pnlTxt}) : sur un signal vendeur, envisager de sécuriser une partie des gains plutôt que de tout vendre.`;
    } else if (latentPnlPct != null && latentPnlPct < 0) {
      reading = `Vous détenez ${quantity} titre${quantity > 1 ? 's' : ''} en moins-value (${pnlTxt}) : vendre maintenant matérialiserait la perte — arbitrer selon votre horizon plutôt que de subir le signal.`;
    } else {
      reading = `Vous détenez ${quantity} titre${quantity > 1 ? 's' : ''} (${pnlTxt}) : signal vendeur, surveiller un point de sortie.`;
    }
  } else if (signal === 'BUY') {
    reading = `Vous détenez déjà ${quantity} titre${quantity > 1 ? 's' : ''} (${pnlTxt}) : signal acheteur, un renforcement est envisageable.`;
  } else {
    reading = `Vous détenez ${quantity} titre${quantity > 1 ? 's' : ''} (${pnlTxt}) : pas de signal franc, conserver.`;
  }

  return { held: true, pru, quantity, latentPnlPct, reading };
}
