/**
 * Pages sous `/premium/…` réservées aux abonnés PAR LEUR ADRESSE (middleware).
 * PUR : lu par le middleware (Edge) et par les cartes d'outils de l'accueil.
 *
 * Exemptions : la page d'offre, et le portefeuille virtuel, gratuit depuis le
 * 2026-11-13 (son adresse est conservée pour ne casser aucun lien).
 */
export const EXEMPTIONS_PREMIUM = ['/premium/upgrade', '/premium/paper-trading'];

export function estCheminPremium(chemin: string): boolean {
  if (chemin !== '/premium' && !chemin.startsWith('/premium/')) return false;
  return !EXEMPTIONS_PREMIUM.some((e) => chemin === e || chemin.startsWith(`${e}/`));
}
