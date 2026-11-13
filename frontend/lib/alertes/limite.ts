/**
 * Combien d'alertes un compte peut créer — PUR, testé.
 *
 * Premium : illimité. Gratuit : `quota_free` du drapeau `alertes` (1 au
 * 2026-11-13), et seulement sur le PRIX : une alerte « signal », « RSI » ou
 * « saison » livrerait le contenu d'outils réservés au Premium.
 * `null` = illimité.
 */
export const TYPES_PRIX = ['prix_au_dessus', 'prix_en_dessous', 'variation'] as const;

export function limiteAlertes(premium: boolean, quotaGratuit: number | null): number | null {
  if (premium) return null;
  return Math.max(0, quotaGratuit ?? 0);
}

export function refusCreation(args: { premium: boolean; limite: number | null; existantes: number; type: string }): string | null {
  if (args.premium || args.limite == null) return null;
  if (args.limite === 0) return 'Les alertes sont réservées aux abonnés Premium.';
  if (!(TYPES_PRIX as readonly string[]).includes(args.type)) {
    return 'En formule gratuite, une alerte porte sur le prix. Les alertes de signal, de RSI, de dividende et de saison sont réservées au Premium.';
  }
  if (args.existantes >= args.limite) {
    return `La formule gratuite comprend ${args.limite} alerte${args.limite > 1 ? 's' : ''}. Supprimez-la ou passez à Premium pour en créer d'autres.`;
  }
  return null;
}
