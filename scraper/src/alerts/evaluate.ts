/**
 * Logique pure d'évaluation d'une alerte. Testable sans I/O.
 *
 * Types « prix » (seuil obligatoire) + types « intelligents » pilotés par les
 * données quotidiennes (signal, RSI, calendrier dividende).
 */
export type AlertType =
  | 'prix_au_dessus' | 'prix_en_dessous' | 'variation'
  | 'signal_achat' | 'signal_vente'
  | 'rsi_survente' | 'rsi_surachat'
  | 'dividende_proche';

/** Seuils par défaut des types intelligents (si seuil non renseigné). */
export const SMART_DEFAULTS = { rsi_survente: 30, rsi_surachat: 70, dividende_proche: 7 } as const;

export interface Evaluable {
  type: AlertType;
  seuil: number | null;
}

/** Contexte « intelligent » du jour pour un instrument. */
export interface SmartContext {
  signal: 'BUY' | 'HOLD' | 'SELL' | null;
  rsi: number | null;
  daysToExDividend: number | null; // jours avant prochain détachement (>=0), null si aucun
}

/** Déclenchement d'une alerte prix. */
export function isTriggered(
  a: Evaluable,
  last: number | null,
  variationPct: number | null,
): boolean {
  if (a.seuil == null) return false;
  if (a.type === 'prix_au_dessus') return last != null && last >= a.seuil;
  if (a.type === 'prix_en_dessous') return last != null && last <= a.seuil;
  if (a.type === 'variation') return variationPct != null && Math.abs(variationPct) >= a.seuil;
  return false;
}

/** Déclenchement d'une alerte intelligente (signal / RSI / dividende). */
export function isSmartTriggered(a: Evaluable, ctx: SmartContext): boolean {
  switch (a.type) {
    case 'signal_achat': return ctx.signal === 'BUY';
    case 'signal_vente': return ctx.signal === 'SELL';
    case 'rsi_survente': return ctx.rsi != null && ctx.rsi < (a.seuil ?? SMART_DEFAULTS.rsi_survente);
    case 'rsi_surachat': return ctx.rsi != null && ctx.rsi > (a.seuil ?? SMART_DEFAULTS.rsi_surachat);
    case 'dividende_proche':
      return ctx.daysToExDividend != null && ctx.daysToExDividend >= 0 &&
        ctx.daysToExDividend <= (a.seuil ?? SMART_DEFAULTS.dividende_proche);
    default: return false;
  }
}

/** True si le type est un type « intelligent » (piloté par le contexte). */
export function isSmartType(t: AlertType): boolean {
  return t === 'signal_achat' || t === 'signal_vente' || t === 'rsi_survente' || t === 'rsi_surachat' || t === 'dividende_proche';
}
