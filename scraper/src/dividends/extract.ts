/**
 * Extraction du montant de dividende depuis un texte de communiqué.
 * Cherche un montant FCFA proche du mot "dividende" / "coupon".
 * Renvoie null si rien d'exploitable (on ne devine pas).
 */
import { parseFrNumber } from '../utils/parseNumber.js';

/**
 * Un millésime n'est pas un montant.
 *
 * DÉFAUT CORRIGÉ LE 2026-09-08 : le motif de repli `/dividende[^\d]*(\d+)/`
 * appliqué à « AVIS DE PAIEMENT DE DIVIDENDE 2013 » capturait « 2013 » comme
 * montant. `extractExercice` en tirait la même année, et la base se retrouvait
 * avec montant = exercice. 90 lignes sur 353 étaient dans ce cas, sur 28
 * sociétés et 16 exercices — un quart de la table.
 *
 * Le piège est qu'un tel montant reste syntaxiquement valide : rien ne le
 * distingue d'un vrai dividende sans cette vérification explicite.
 */
function ressembleAUnMillesime(n: number): boolean {
  return Number.isInteger(n) && n >= 1990 && n <= 2100;
}

export function extractDividendAmount(text: string): number | null {
  const t = text.toLowerCase();
  if (!/(dividende|coupon)/.test(t)) return null;

  // Cherche un nombre suivi (ou précédé) de FCFA/XOF, ou "X par action".
  const patterns = [
    /([\d  .,]+)\s*(?:fcfa|xof|f\b)/i,
    /([\d  .,]+)\s*par\s+action/i,
    /dividende[^\d]*([\d  .,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = parseFrNumber(m[1]);
      if (n == null || n <= 0) continue;
      /* Un nombre qui est exactement une année est rejeté, quel que soit le
         motif qui l'a capturé. Certains titres portent réellement un montant
         entier dans cette plage, mais le risque d'accepter un millésime est
         bien pire : il produit une donnée fausse ET plausible, invisible
         jusqu'à un recoupement externe. On préfère le trou. */
      if (ressembleAUnMillesime(n)) continue;
      return n;
    }
  }
  return null;
}

/** Déduit l'année d'exercice depuis le texte (ex "exercice 2025", "dividende 2025"). */
export function extractExercice(text: string, fallbackYear: number): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  if (m) return Number(m[1]);
  return fallbackYear;
}
