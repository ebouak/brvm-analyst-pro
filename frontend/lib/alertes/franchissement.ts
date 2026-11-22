/**
 * Alertes de PRIX vues en direct dans la page (pur, testé).
 *
 * ⚠️ DUPLICATION ASSUMÉE : les trois règles de `conditionRemplie` reprennent
 * `scraper/src/alerts/evaluate.ts` (deux paquets TS distincts, comme
 * `scraper/src/hebdo/pure/`). Toute correction se reporte des deux côtés.
 *
 * Ce module ne notifie RIEN hors de la page : l'e-mail et Telegram restent
 * l'affaire du serveur, avec son propre délai de relance. Il ne signale que
 * ce que la personne voit arriver pendant sa visite : un FRANCHISSEMENT
 * (condition fausse au relevé précédent, vraie maintenant). Une condition
 * déjà remplie à l'arrivée sur la page ne produit aucun message.
 * Les alertes sur signaux, RSI ou dividende ne sont pas concernées.
 */
import { fmtNumber, fmtPctSigne } from '@/lib/format';

export type TypeAlertePrix = 'prix_au_dessus' | 'prix_en_dessous' | 'variation';
export const TYPES_ALERTE_PRIX: readonly TypeAlertePrix[] = ['prix_au_dessus', 'prix_en_dessous', 'variation'];

export interface AlertePrix {
  id: string;
  code: string;
  type: TypeAlertePrix;
  seuil: number;
}

export interface CoursVu {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
}

/** Mêmes règles que le serveur (evaluate.ts). */
export function conditionRemplie(a: AlertePrix, cours: number | null, variation: number | null): boolean {
  if (a.type === 'prix_au_dessus') return cours != null && cours >= a.seuil;
  if (a.type === 'prix_en_dessous') return cours != null && cours <= a.seuil;
  return variation != null && Math.abs(variation) >= a.seuil;
}

/** État initial : ce qui est déjà vrai à l'arrivée ne sera pas signalé. */
export function etatInitial(alertes: readonly AlertePrix[], cours: readonly CoursVu[]): Record<string, boolean> {
  const parCode = new Map(cours.map((c) => [c.code, c]));
  const etat: Record<string, boolean> = {};
  for (const a of alertes) {
    const c = parCode.get(a.code);
    etat[a.id] = c ? conditionRemplie(a, c.cours_jour, c.variation_pct) : false;
  }
  return etat;
}

/** Alertes franchies par un nouveau cours, et l'état mis à jour. */
export function franchissements(
  alertes: readonly AlertePrix[],
  etat: Readonly<Record<string, boolean>>,
  recu: CoursVu,
): { declenchees: AlertePrix[]; etat: Record<string, boolean> } {
  const suite = { ...etat };
  const declenchees: AlertePrix[] = [];
  for (const a of alertes) {
    if (a.code !== recu.code) continue;
    const vrai = conditionRemplie(a, recu.cours_jour, recu.variation_pct);
    if (vrai && !etat[a.id]) declenchees.push(a);
    suite[a.id] = vrai;
  }
  return { declenchees, etat: suite };
}

/** Phrase factuelle : ce qui s'est passé et le seuil, rien d'autre. */
export function messageAlerte(a: AlertePrix, recu: CoursVu): string {
  if (a.type === 'prix_au_dessus') return `${a.code} est passé au-dessus de ${fmtNumber(a.seuil)} FCFA`;
  if (a.type === 'prix_en_dessous') return `${a.code} est passé sous ${fmtNumber(a.seuil)} FCFA`;
  return `${a.code} varie de ${fmtPctSigne(recu.variation_pct ?? 0)} sur la séance`;
}
