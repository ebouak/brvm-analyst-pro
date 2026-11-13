/**
 * Phrase d'état de la confrontation du mois en cours — PURE, utilisable côté
 * serveur. Elle vivait dans le composant client ConfrontationMois : l'aperçu
 * gratuit de /saisonnalite (rendu serveur) l'appelait, ce que Next interdit
 * (« Attempted to call … from the server »). Invisible tant que la page était
 * gratuite, l'erreur touchait tout compte non Premium depuis la 0216.
 */
import type { Confrontation } from './server';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NBSP = ' ';
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}${NBSP}%`;
const rangFr = (n: number) => (n === 1 ? '1re' : `${n}e`);

/** Phrase d'état, sans verbe d'ordre. Exportée pour l'aperçu gratuit. */
export function phraseConfrontation(c: Confrontation): string {
  const m = MOIS[c.mois - 1]!;
  const depuis = `Depuis le début de ${m} (${rangFr(c.rangSeance)} séance) : ${pct(c.rdtEnCours)}, dividende compris.`;
  if (c.etat === 'trop_tot') return `${depuis} Trop tôt pour comparer à l’habitude : la comparaison commence à la 5e séance.`;
  if (c.etat === 'historique_insuffisant') return `${depuis} Moins de 5 années comparables : pas de fourchette habituelle.`;
  const fourchette = `Sur ${c.n} années, la fourchette habituelle à la même séance va de ${pct(c.q25!)} à ${pct(c.q75!)}`;
  const lecture = c.etat === 'au_dessus' ? 'au-dessus de son habitude' : c.etat === 'en_dessous' ? 'en dessous de son habitude' : 'dans sa fourchette habituelle';
  return `${depuis} ${fourchette} : le cours est ${lecture}.`;
}
